import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

interface WebSocketLike {
  close(code?: number, reason?: string): void;
}

import { ConnectionContext } from './connection.types';

@Injectable()
export class ConnectionManager implements OnApplicationShutdown {
  private readonly logger = new Logger(ConnectionManager.name);

  private readonly connections = new Map<string, ConnectionContext>();

  private readonly socketToIdentity = new WeakMap<WebSocketLike, string>();

  registerConnection(
    identity: string,
    socket: WebSocketLike,
  ): ConnectionContext {
    const now = new Date();
    const existing = this.connections.get(identity);

    if (existing) {
      this.logger.log(`Replacing existing connection for station ${identity}`);
      try {
        existing.socket.close(1012, 'Replaced by a new connection');
      } catch (error) {
        this.logger.debug(
          `Error closing previous socket for ${identity}: ${String(error)}`,
        );
      }
    }

    const context: ConnectionContext = {
      identity,
      socket,
      connectedAt: now,
      lastMessageAt: now,
      status: 'CONNECTED',
      stationId: existing?.stationId,
    };

    this.connections.set(identity, context);
    this.socketToIdentity.set(socket, identity);

    return context;
  }

  associateStation(identity: string, stationId: string): void {
    const context = this.connections.get(identity);
    if (!context) {
      return;
    }

    context.stationId = stationId;
  }

  updateActivity(identity: string): void {
    const context = this.connections.get(identity);
    if (!context) {
      return;
    }

    context.lastMessageAt = new Date();
    context.status = 'CONNECTED';
  }

  getContext(identity: string): ConnectionContext | undefined {
    return this.connections.get(identity);
  }

  getIdentityBySocket(socket: WebSocketLike): string | undefined {
    return this.socketToIdentity.get(socket);
  }

  markDisconnected(socket: WebSocketLike, reason?: string): void {
    const identity = this.socketToIdentity.get(socket);
    if (!identity) {
      return;
    }

    const context = this.connections.get(identity);
    if (!context || context.socket !== socket) {
      this.socketToIdentity.delete(socket);
      return;
    }

    context.status = 'DISCONNECTED';
    context.lastMessageAt = new Date();
    this.socketToIdentity.delete(socket);

    if (reason) {
      this.logger.log(`Station ${identity} disconnected: ${reason}`);
    } else {
      this.logger.log(`Station ${identity} disconnected`);
    }
  }

  listConnections(): ConnectionContext[] {
    return Array.from(this.connections.values());
  }

  onApplicationShutdown(): void {
    this.logger.log('Closing active WebSocket connections');
    for (const context of this.connections.values()) {
      try {
        context.socket.close(1001, 'Server shutdown');
      } catch (error) {
        this.logger.debug(
          `Failed to close socket for ${context.identity}: ${String(error)}`,
        );
      }
    }
    this.connections.clear();
  }
}
