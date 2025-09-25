import { createHash } from 'crypto';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { parse as parseUrl } from 'url';

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { ConnectionManager } from './connection/connection-manager';
import { OcppCallError } from './ocpp.errors';
import { OcppService } from './ocpp.service';
import { StationMessageService } from './services/station-message.service';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SUPPORTED_SUBPROTOCOLS = new Set(['ocpp1.6', 'ocpp1.6j']);

interface SocketContext {
  identity: string;
  buffer: Buffer;
  connection: {
    close(code?: number, reason?: string): void;
  };
}

@Injectable()
export class OcppWebSocketServer
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(OcppWebSocketServer.name);

  private readonly contexts = new WeakMap<Socket, SocketContext>();

  private upgradeHandler?: (req: IncomingMessage, socket: Socket) => void;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly ocppService: OcppService,
    private readonly connectionManager: ConnectionManager,
    private readonly stationMessageService: StationMessageService,
  ) {}

  onModuleInit(): void {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    this.upgradeHandler = (request, socket) =>
      this.handleUpgrade(request, socket);
    httpServer.on('upgrade', this.upgradeHandler);
    this.logger.log('OCPP WebSocket server initialised');
  }

  onApplicationShutdown(): void {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    if (this.upgradeHandler) {
      httpServer.off('upgrade', this.upgradeHandler);
    }
  }

  private handleUpgrade(request: IncomingMessage, socket: Socket): void {
    const url = request.url ?? '';
    const parsed = parseUrl(url, true);
    const segments = parsed.pathname?.split('/').filter(Boolean) ?? [];

    const ocppIndex = segments.indexOf('ocpp');

    if (ocppIndex === -1 || ocppIndex !== segments.length - 2) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const identity = segments[segments.length - 1];

    const key = request.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const { selectedProtocol, reject } = this.negotiateSubProtocol(
      request.headers['sec-websocket-protocol'],
    );
    if (reject) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = createHash('sha1')
      .update(key + WEBSOCKET_GUID)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
    ];

    if (selectedProtocol) {
      responseHeaders.push(`Sec-WebSocket-Protocol: ${selectedProtocol}`);
    }

    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    this.registerSocket(identity, socket, request.url);
  }

  private negotiateSubProtocol(header: string | string[] | undefined): {
    selectedProtocol?: string;
    reject: boolean;
  } {
    if (header === undefined) {
      return { reject: false };
    }

    const values = Array.isArray(header)
      ? header.flatMap((item) => item.split(','))
      : header.split(',');

    for (const value of values) {
      const trimmed = value.trim();
      if (SUPPORTED_SUBPROTOCOLS.has(trimmed)) {
        return { selectedProtocol: trimmed, reject: false };
      }
    }

    return { reject: true };
  }

  private registerSocket(
    identity: string,
    socket: Socket,
    endpoint?: string,
  ): void {
    const webSocketLike = {
      close: (code?: number, reason?: string) => {
        this.sendCloseFrame(socket, code ?? 1000, reason);
      },
    };

    this.contexts.set(socket, {
      identity,
      buffer: Buffer.alloc(0),
      connection: webSocketLike,
    });

    const context = this.connectionManager.registerConnection(
      identity,
      webSocketLike,
    );

    socket.on('data', (chunk) => this.handleFrame(socket, chunk, endpoint));
    socket.on('close', () =>
      this.connectionManager.markDisconnected(webSocketLike, 'socket closed'),
    );
    socket.on('error', (error) => {
      this.logger.warn(
        `Socket error for station ${identity}: ${error.message}`,
      );
      this.connectionManager.markDisconnected(webSocketLike, 'socket error');
      socket.destroy();
    });

    void this.flushQueuedMessages(context.stationId, socket);
  }

  private async handleFrame(socket: Socket, data: Buffer, endpoint?: string) {
    const context = this.contexts.get(socket);
    if (!context) {
      return;
    }

    context.buffer = Buffer.concat([context.buffer, data]);

    while (true) {
      const frame = this.extractFrame(context.buffer);
      if (!frame) {
        break;
      }

      context.buffer = frame.remaining;

      if (!frame.fin) {
        this.sendCloseFrame(socket, 1003, 'Fragmentation not supported');
        socket.destroy();
        break;
      }

      if (frame.opcode === 0x8) {
        this.connectionManager.markDisconnected(
          context.connection,
          'close frame',
        );
        socket.end();
        break;
      }

      if (frame.opcode === 0x9) {
        this.sendPong(socket, frame.payload);
        continue;
      }

      if (frame.opcode !== 0x1) {
        this.sendCloseFrame(socket, 1003, 'Unsupported frame');
        socket.destroy();
        break;
      }

      try {
        const message = frame.payload.toString('utf8');
        const result = await this.ocppService.handleMessage(
          context.identity,
          message,
          endpoint,
        );

        this.connectionManager.updateActivity(context.identity);
        this.sendText(socket, result.reply);

        if (result.stationId) {
          this.connectionManager.associateStation(
            context.identity,
            result.stationId,
          );
        }

        if (result.flushPendingMessages) {
          const refreshed = this.connectionManager.getContext(context.identity);
          await this.flushQueuedMessages(refreshed?.stationId, socket);
        }
      } catch (error) {
        const callError = this.buildCallErrorPayload(
          frame.payload.toString('utf8'),
          error,
        );
        if (callError) {
          this.sendText(socket, callError);
        } else {
          this.sendCloseFrame(socket, 1011, 'Protocol error');
          socket.destroy();
          break;
        }
      }
    }
  }

  private extractFrame(
    buffer: Buffer,
  ):
    | { fin: boolean; opcode: number; payload: Buffer; remaining: Buffer }
    | undefined {
    if (buffer.length < 2) {
      return undefined;
    }

    const firstByte = buffer[0];
    const secondByte = buffer[1];

    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (buffer.length < offset + 2) {
        return undefined;
      }
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (buffer.length < offset + 8) {
        return undefined;
      }
      const high = buffer.readUInt32BE(offset);
      const low = buffer.readUInt32BE(offset + 4);
      payloadLength = high * 2 ** 32 + low;
      offset += 8;
    }

    if (masked && buffer.length < offset + 4) {
      return undefined;
    }

    const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
    offset += masked ? 4 : 0;

    if (buffer.length < offset + payloadLength) {
      return undefined;
    }

    let payload = buffer.subarray(offset, offset + payloadLength);

    if (masked && mask) {
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) {
        unmasked[i] = payload[i] ^ mask[i % 4];
      }
      payload = unmasked;
    }

    const remaining = buffer.subarray(offset + payloadLength);
    return { fin, opcode, payload, remaining };
  }

  private sendText(socket: Socket, message: string): void {
    const payload = Buffer.from(message, 'utf8');
    const frame = this.buildFrame(0x1, payload);
    socket.write(frame);
  }

  private sendPong(socket: Socket, payload: Buffer): void {
    const frame = this.buildFrame(0xa, payload);
    socket.write(frame);
  }

  private sendCloseFrame(socket: Socket, code: number, reason?: string): void {
    const payload = Buffer.alloc(reason ? 2 + Buffer.byteLength(reason) : 2);
    payload.writeUInt16BE(code, 0);
    if (reason) {
      payload.write(reason, 2);
    }
    const frame = this.buildFrame(0x8, payload);
    socket.write(frame);
  }

  private buildFrame(opcode: number, payload: Buffer): Buffer {
    const length = payload.length;
    let headerLength = 2;

    if (length >= 126 && length < 65536) {
      headerLength += 2;
    } else if (length >= 65536) {
      headerLength += 8;
    }

    const frame = Buffer.alloc(headerLength + length);
    frame[0] = 0x80 | opcode;

    if (length < 126) {
      frame[1] = length;
    } else if (length < 65536) {
      frame[1] = 126;
      frame.writeUInt16BE(length, 2);
    } else {
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(length), 2);
    }

    payload.copy(frame, headerLength);
    return frame;
  }

  private buildCallErrorPayload(
    rawMessage: string,
    error: unknown,
  ): string | null {
    let uniqueId: string | undefined;

    try {
      const parsed = JSON.parse(rawMessage);
      if (Array.isArray(parsed) && typeof parsed[1] === 'string') {
        uniqueId = parsed[1];
      }
    } catch {
      uniqueId = undefined;
    }

    if (!uniqueId) {
      return null;
    }

    const { code, description, details } = this.resolveError(error);

    return JSON.stringify([4, uniqueId, code, description, details]);
  }

  private async flushQueuedMessages(
    stationId: string | undefined,
    socket: Socket,
  ): Promise<void> {
    if (!stationId) {
      return;
    }

    const pending =
      await this.stationMessageService.listPendingMessages(stationId);

    for (const message of pending) {
      const payload = JSON.stringify([
        2,
        message.uniqueId,
        message.action,
        message.payload,
      ]);
      try {
        this.sendText(socket, payload);
        await this.stationMessageService.markAsDispatched(message.id);
      } catch (error) {
        await this.stationMessageService.markAsFailed(message.id, error);
        break;
      }
    }
  }

  private resolveError(error: unknown): {
    code: string;
    description: string;
    details: Record<string, unknown>;
  } {
    if (error instanceof OcppCallError) {
      return {
        code: error.code,
        description: error.message,
        details: error.details,
      };
    }

    if (error instanceof Error) {
      switch (error.message) {
        case 'FormationViolation':
          return {
            code: 'FormationViolation',
            description: 'Message is not valid JSON',
            details: {},
          };
        case 'ProtocolError':
          return {
            code: 'ProtocolError',
            description: 'Message is not a valid CALL',
            details: {},
          };
        case 'NotSupported':
          return {
            code: 'NotSupported',
            description: 'Only CALL messages are supported',
            details: {},
          };
        case 'NotImplemented':
          return {
            code: 'NotImplemented',
            description: 'Requested OCPP action is not supported',
            details: {},
          };
        default:
          return {
            code: 'InternalError',
            description: error.message,
            details: {},
          };
      }
    }

    return {
      code: 'InternalError',
      description: 'Unknown error',
      details: {},
    };
  }
}
