import { Injectable, Logger } from '@nestjs/common';

import { ChargingStationService } from './services/charging-station.service';
import { ConnectionManager } from './connection/connection-manager';
import {
  BootNotificationPayload,
  MeterValuesPayload,
  parseBootNotification,
  parseMeterValues,
  parseStartTransaction,
  parseStatusNotification,
  parseStopTransaction,
  StartTransactionPayload,
  StatusNotificationPayload,
  StopTransactionPayload,
} from './messages/schemas';

export interface ProcessedOcppMessage {
  reply: string;
  stationId?: string;
  flushPendingMessages?: boolean;
}

@Injectable()
export class OcppService {
  private readonly logger = new Logger(OcppService.name);

  constructor(
    private readonly chargingStationService: ChargingStationService,
    private readonly connectionManager: ConnectionManager,
  ) {}

  async handleMessage(
    identity: string,
    rawMessage: string,
    endpoint?: string,
  ): Promise<ProcessedOcppMessage> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawMessage);
    } catch (error) {
      this.logger.warn(`Invalid JSON payload from ${identity}: ${rawMessage}`);
      throw new Error('FormationViolation');
    }

    if (!Array.isArray(parsed) || parsed.length < 3) {
      throw new Error('ProtocolError');
    }

    const [messageType, uniqueId] = parsed;

    if (messageType !== 2) {
      throw new Error('NotSupported');
    }

    if (typeof uniqueId !== 'string') {
      throw new Error('ProtocolError');
    }

    const action = parsed[2];
    const payload = parsed[3] ?? {};

    switch (action) {
      case 'BootNotification':
        return this.handleBootNotification(
          identity,
          uniqueId,
          payload,
          endpoint,
        );
      case 'Heartbeat':
        return this.createCallResult(
          uniqueId,
          await this.chargingStationService.handleHeartbeat(identity),
        );
      case 'StatusNotification':
        await this.chargingStationService.handleStatusNotification(
          identity,
          this.parseStatusNotificationPayload(payload),
        );
        return this.createCallResult(uniqueId, {});
      case 'StartTransaction':
        return this.createCallResult(
          uniqueId,
          await this.chargingStationService.handleStartTransaction(
            identity,
            this.parseStartTransactionPayload(payload),
          ),
        );
      case 'StopTransaction':
        await this.chargingStationService.handleStopTransaction(
          this.parseStopTransactionPayload(payload),
        );
        return this.createCallResult(uniqueId, {
          idTagInfo: {
            status: 'Accepted',
          },
        });
      case 'MeterValues':
        await this.chargingStationService.handleMeterValues(
          identity,
          this.parseMeterValuesPayload(payload),
        );
        return this.createCallResult(uniqueId, {});
      default:
        this.logger.warn(`Unsupported OCPP action received: ${String(action)}`);
        throw new Error('NotImplemented');
    }
  }

  private async handleBootNotification(
    identity: string,
    uniqueId: string,
    rawPayload: unknown,
    endpoint?: string,
  ): Promise<ProcessedOcppMessage> {
    const payload = parseBootNotification(rawPayload);

    const result = await this.chargingStationService.handleBootNotification(
      identity,
      payload,
      endpoint,
    );

    this.connectionManager.associateStation(identity, result.stationId);

    return {
      ...this.createCallResult(uniqueId, result.response),
      stationId: result.stationId,
      flushPendingMessages: true,
    };
  }

  private createCallResult(
    uniqueId: string,
    payload: unknown,
  ): ProcessedOcppMessage {
    return {
      reply: JSON.stringify([3, uniqueId, payload ?? {}]),
    };
  }

  private parseStatusNotificationPayload(
    payload: unknown,
  ): StatusNotificationPayload {
    return parseStatusNotification(payload);
  }

  private parseStartTransactionPayload(
    payload: unknown,
  ): StartTransactionPayload {
    return parseStartTransaction(payload);
  }

  private parseStopTransactionPayload(
    payload: unknown,
  ): StopTransactionPayload {
    return parseStopTransaction(payload);
  }

  private parseMeterValuesPayload(payload: unknown): MeterValuesPayload {
    return parseMeterValues(payload);
  }
}
