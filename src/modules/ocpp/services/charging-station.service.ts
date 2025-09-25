import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectorStatus,
  Prisma,
  StationLogEvent,
  StationStatus,
  TransactionStatus,
} from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { OcppConfigurationService } from 'src/configurations/ocpp/ocpp-configuration.service';
import {
  BootNotificationPayload,
  MeterValuesPayload,
  StartTransactionPayload,
  StatusNotificationPayload,
  StopTransactionPayload,
} from '../messages/schemas';
import { OcppCallError } from '../ocpp.errors';

interface MemoryConnectorState {
  status: ConnectorStatus;
  errorCode: string;
  info: string | null;
  vendorErrorCode: string | null;
  statusTimestamp: Date;
}

interface MemoryTransactionState {
  id: number;
  connectorId: number;
  idTag: string;
  meterStart: number;
  startedAt: Date;
  status: TransactionStatus;
  meterStop?: number;
  stoppedAt?: Date;
  reason?: string | null;
}

interface MemoryStationState {
  id: string;
  identity: string;
  vendor: string | null;
  model: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  endpoint: string | null;
  lastHeartbeatAt: Date;
  status: StationStatus;
  connectors: Map<number, MemoryConnectorState>;
  transactions: Map<number, MemoryTransactionState>;
}

type StationRecord = {
  id: string;
  ocppIdentity: string;
  vendor: string | null;
  model: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  endpoint: string | null;
  lastHeartbeatAt: Date;
  status: StationStatus;
};

@Injectable()
export class ChargingStationService {
  private readonly logger = new Logger(ChargingStationService.name);

  private readonly connectorStatusMap: Record<string, ConnectorStatus> = {
    Available: ConnectorStatus.AVAILABLE,
    Preparing: ConnectorStatus.PREPARING,
    Charging: ConnectorStatus.CHARGING,
    SuspendedEV: ConnectorStatus.SUSPENDEDEV,
    SuspendedEVSE: ConnectorStatus.SUSPENDEDEVSE,
    Finishing: ConnectorStatus.FINISHING,
    Reserved: ConnectorStatus.RESERVED,
    Unavailable: ConnectorStatus.UNAVAILABLE,
    Faulted: ConnectorStatus.FAULTED,
  };

  private readonly memoryStations = new Map<string, MemoryStationState>();
  private readonly memoryTransactions = new Map<
    number,
    { stationIdentity: string }
  >();
  private nextFallbackTransactionId = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocppConfig: OcppConfigurationService,
  ) {}

  async handleBootNotification(
    identity: string,
    payload: BootNotificationPayload,
    endpoint?: string,
  ): Promise<{ stationId: string; response: Record<string, unknown> }> {
    const now = new Date();

    if (this.useFallback()) {
      const station = this.getOrCreateMemoryStation(identity);
      station.vendor = payload.chargePointVendor;
      station.model = payload.chargePointModel;
      station.serialNumber =
        payload.chargePointSerialNumber ??
        payload.chargeBoxSerialNumber ??
        payload.meterSerialNumber ??
        null;
      station.firmwareVersion = payload.firmwareVersion ?? null;
      station.endpoint = endpoint ?? null;
      station.lastHeartbeatAt = now;
      station.status = StationStatus.AVAILABLE;

      return {
        stationId: station.id,
        response: {
          status: 'Accepted',
          currentTime: now.toISOString(),
          interval: this.ocppConfig.heartbeatIntervalSeconds,
        },
      };
    }

    const station = await this.prisma.chargingStation.upsert({
      where: { ocppIdentity: identity },
      create: {
        ocppIdentity: identity,
        vendor: payload.chargePointVendor,
        model: payload.chargePointModel,
        serialNumber:
          payload.chargePointSerialNumber ??
          payload.chargeBoxSerialNumber ??
          payload.meterSerialNumber ??
          null,
        firmwareVersion: payload.firmwareVersion ?? null,
        endpoint: endpoint ?? null,
        lastHeartbeatAt: now,
        status: StationStatus.AVAILABLE,
      },
      update: {
        vendor: payload.chargePointVendor,
        model: payload.chargePointModel,
        serialNumber:
          payload.chargePointSerialNumber ??
          payload.chargeBoxSerialNumber ??
          payload.meterSerialNumber ??
          null,
        firmwareVersion: payload.firmwareVersion ?? null,
        endpoint: endpoint ?? null,
        lastHeartbeatAt: now,
        status: StationStatus.AVAILABLE,
      },
    });

    await this.recordStationEvent(
      station.id,
      StationLogEvent.BOOT_NOTIFICATION,
      {
        payload,
        endpoint: endpoint ?? null,
      },
      { receivedAt: now.toISOString() },
    );

    return {
      stationId: station.id,
      response: {
        status: 'Accepted',
        currentTime: now.toISOString(),
        interval: this.ocppConfig.heartbeatIntervalSeconds,
      },
    };
  }

  async handleHeartbeat(identity: string): Promise<{ currentTime: string }> {
    const now = new Date();

    if (this.useFallback()) {
      const station = this.getOrCreateMemoryStation(identity);
      station.lastHeartbeatAt = now;
      return { currentTime: now.toISOString() };
    }

    const station = await this.ensureStation(identity);

    await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: { lastHeartbeatAt: now },
    });

    await this.recordStationEvent(station.id, StationLogEvent.HEARTBEAT, {
      receivedAt: now.toISOString(),
    });

    return { currentTime: now.toISOString() };
  }

  async handleStatusNotification(
    identity: string,
    payload: StatusNotificationPayload,
  ): Promise<void> {
    const connectorStatus = this.resolveConnectorStatus(payload.status);
    const statusTimestamp = payload.timestamp
      ? new Date(payload.timestamp)
      : new Date();

    if (this.useFallback()) {
      const station = this.getOrCreateMemoryStation(identity);
      const connectorState: MemoryConnectorState = {
        status: connectorStatus,
        errorCode: payload.errorCode,
        info: payload.info ?? null,
        vendorErrorCode: payload.vendorErrorCode ?? null,
        statusTimestamp,
      };
      station.connectors.set(payload.connectorId, connectorState);

      if (payload.connectorId === 0) {
        station.status = this.deriveStationStatus(connectorStatus);
      } else if (connectorStatus === ConnectorStatus.CHARGING) {
        station.status = StationStatus.CHARGING;
      } else {
        this.updateStationStatusFromConnectors(station);
      }
      return;
    }

    const station = await this.ensureStation(identity);

    const connector = await this.prisma.chargingConnector.upsert({
      where: {
        stationId_ocppConnectorId: {
          stationId: station.id,
          ocppConnectorId: payload.connectorId,
        },
      },
      create: {
        stationId: station.id,
        ocppConnectorId: payload.connectorId,
        status: connectorStatus,
        errorCode: payload.errorCode,
        info: payload.info ?? null,
        vendorErrorCode: payload.vendorErrorCode ?? null,
        statusTimestamp,
      },
      update: {
        status: connectorStatus,
        errorCode: payload.errorCode,
        info: payload.info ?? null,
        vendorErrorCode: payload.vendorErrorCode ?? null,
        statusTimestamp,
      },
    });

    if (payload.connectorId === 0) {
      await this.prisma.chargingStation.update({
        where: { id: station.id },
        data: { status: this.deriveStationStatus(connectorStatus) },
      });
    } else if (connector.status === ConnectorStatus.CHARGING) {
      await this.prisma.chargingStation.update({
        where: { id: station.id },
        data: { status: StationStatus.CHARGING },
      });
    }

    await this.recordStationEvent(
      station.id,
      StationLogEvent.STATUS_NOTIFICATION,
      {
        connectorId: payload.connectorId,
        status: payload.status,
        errorCode: payload.errorCode,
        info: payload.info ?? null,
        vendorErrorCode: payload.vendorErrorCode ?? null,
        timestamp: statusTimestamp.toISOString(),
      },
    );
  }

  async handleStartTransaction(
    identity: string,
    payload: StartTransactionPayload,
  ): Promise<{ transactionId: number }> {
    const startedAt = new Date(payload.timestamp);

    if (this.useFallback()) {
      const station = this.getOrCreateMemoryStation(identity);
      const transactionId = this.nextFallbackTransactionId;
      this.nextFallbackTransactionId += 1;

      const connector = station.connectors.get(payload.connectorId) ?? {
        status: ConnectorStatus.AVAILABLE,
        errorCode: 'NoError',
        info: null,
        vendorErrorCode: null,
        statusTimestamp: startedAt,
      };
      connector.status = ConnectorStatus.CHARGING;
      connector.errorCode = 'NoError';
      connector.statusTimestamp = startedAt;
      station.connectors.set(payload.connectorId, connector);

      const transaction: MemoryTransactionState = {
        id: transactionId,
        connectorId: payload.connectorId,
        idTag: payload.idTag,
        meterStart: payload.meterStart,
        startedAt,
        status: TransactionStatus.STARTED,
      };
      station.transactions.set(transactionId, transaction);
      this.memoryTransactions.set(transactionId, { stationIdentity: identity });
      station.status = StationStatus.CHARGING;

      return { transactionId };
    }

    const station = await this.ensureStation(identity);

    const connector = await this.prisma.chargingConnector.upsert({
      where: {
        stationId_ocppConnectorId: {
          stationId: station.id,
          ocppConnectorId: payload.connectorId,
        },
      },
      create: {
        stationId: station.id,
        ocppConnectorId: payload.connectorId,
        status: ConnectorStatus.CHARGING,
        errorCode: 'NoError',
        statusTimestamp: startedAt,
      },
      update: {
        status: ConnectorStatus.CHARGING,
        errorCode: 'NoError',
        statusTimestamp: startedAt,
      },
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        stationId: station.id,
        connectorId: connector.id,
        ocppConnectorId: payload.connectorId,
        idTag: payload.idTag,
        meterStart: payload.meterStart,
        startedAt,
        reservationId: payload.reservationId ?? null,
        status: TransactionStatus.STARTED,
      },
    });

    await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: { status: StationStatus.CHARGING },
    });

    await this.recordStationEvent(
      station.id,
      StationLogEvent.START_TRANSACTION,
      {
        transactionId: transaction.id.toString(),
        connectorId: payload.connectorId,
        idTag: payload.idTag,
        meterStart: payload.meterStart,
        reservationId: payload.reservationId ?? null,
        startedAt: startedAt.toISOString(),
      },
    );

    return { transactionId: Number(transaction.id) };
  }

  async handleStopTransaction(payload: StopTransactionPayload): Promise<void> {
    if (this.useFallback()) {
      const mapping = this.memoryTransactions.get(payload.transactionId);
      if (!mapping) {
        throw new OcppCallError(
          'PropertyConstraintViolation',
          `Transaction ${payload.transactionId} could not be found`,
        );
      }

      const station = this.getOrCreateMemoryStation(mapping.stationIdentity);
      const transaction = station.transactions.get(payload.transactionId);
      if (!transaction) {
        throw new OcppCallError(
          'PropertyConstraintViolation',
          `Transaction ${payload.transactionId} could not be found`,
        );
      }

      transaction.status = TransactionStatus.COMPLETED;
      transaction.meterStop = payload.meterStop;
      transaction.stoppedAt = new Date(payload.timestamp);
      transaction.reason = payload.reason ?? null;

      const connector = station.connectors.get(transaction.connectorId);
      if (connector) {
        connector.status = ConnectorStatus.AVAILABLE;
        connector.statusTimestamp = transaction.stoppedAt ?? new Date();
        connector.errorCode = 'NoError';
      }

      station.transactions.delete(payload.transactionId);
      this.memoryTransactions.delete(payload.transactionId);
      this.updateStationStatusFromConnectors(station);
      return;
    }

    const transactionId = BigInt(payload.transactionId);
    const existing = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existing) {
      throw new OcppCallError(
        'PropertyConstraintViolation',
        `Transaction ${payload.transactionId} could not be found`,
      );
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        meterStop: payload.meterStop,
        stoppedAt: new Date(payload.timestamp),
        reason: payload.reason ?? null,
        status: TransactionStatus.COMPLETED,
      },
    });

    if (existing.connectorId) {
      await this.prisma.chargingConnector.update({
        where: { id: existing.connectorId },
        data: { status: ConnectorStatus.AVAILABLE },
      });
    }

    await this.prisma.chargingStation.update({
      where: { id: existing.stationId },
      data: { status: StationStatus.AVAILABLE },
    });

    await this.recordStationEvent(
      existing.stationId,
      StationLogEvent.STOP_TRANSACTION,
      {
        transactionId: payload.transactionId.toString(),
        meterStop: payload.meterStop,
        reason: payload.reason ?? null,
        stoppedAt: payload.timestamp,
      },
    );
  }

  async handleMeterValues(
    identity: string,
    payload: MeterValuesPayload,
  ): Promise<void> {
    if (this.useFallback()) {
      // In-memory mode does not persist meter values but acknowledges receipt.
      return;
    }

    const station = await this.ensureStation(identity);

    const transactionId = payload.transactionId
      ? BigInt(payload.transactionId)
      : undefined;

    const rows: Prisma.MeterValueCreateManyInput[] = [];

    for (const entry of payload.meterValue) {
      const sampledAt = new Date(entry.timestamp);

      for (const sample of entry.sampledValue) {
        const value = new Prisma.Decimal(sample.value);
        rows.push({
          stationId: station.id,
          connectorId: payload.connectorId,
          transactionId: transactionId ?? null,
          sampledAt,
          value,
          context: sample.context ?? null,
          format: sample.format ?? null,
          measurand: sample.measurand ?? null,
          phase: sample.phase ?? null,
          location: sample.location ?? null,
          unit: sample.unit ?? null,
        });
      }
    }

    if (rows.length === 0) {
      return;
    }

    await this.prisma.meterValue.createMany({ data: rows });

    await this.recordStationEvent(station.id, StationLogEvent.METER_VALUES, {
      connectorId: payload.connectorId,
      transactionId: payload.transactionId ?? null,
      samples: rows.length,
    });
  }

  async getStationByIdentity(identity: string): Promise<StationRecord | null> {
    if (this.useFallback()) {
      const station = this.memoryStations.get(identity);
      return station ? this.buildStationRecord(station) : null;
    }

    const station = await this.prisma.chargingStation.findUnique({
      where: { ocppIdentity: identity },
    });

    if (!station) {
      return null;
    }

    return {
      id: station.id,
      ocppIdentity: station.ocppIdentity,
      vendor: station.vendor,
      model: station.model,
      serialNumber: station.serialNumber,
      firmwareVersion: station.firmwareVersion,
      endpoint: station.endpoint,
      lastHeartbeatAt: station.lastHeartbeatAt ?? new Date(),
      status: station.status,
    };
  }

  async ensureStation(identity: string) {
    const station = await this.getStationByIdentity(identity);
    if (!station) {
      throw new OcppCallError(
        'SecurityError',
        `Station ${identity} has not completed a BootNotification`,
      );
    }
    return station;
  }

  private deriveStationStatus(connectorStatus: ConnectorStatus): StationStatus {
    switch (connectorStatus) {
      case ConnectorStatus.CHARGING:
        return StationStatus.CHARGING;
      case ConnectorStatus.FAULTED:
        return StationStatus.FAULTED;
      case ConnectorStatus.UNAVAILABLE:
        return StationStatus.UNAVAILABLE;
      default:
        return StationStatus.AVAILABLE;
    }
  }

  private resolveConnectorStatus(rawStatus: string): ConnectorStatus {
    const status = this.connectorStatusMap[rawStatus];
    if (!status) {
      this.logger.warn(`Unknown connector status received: ${rawStatus}`);
      return ConnectorStatus.UNAVAILABLE;
    }
    return status;
  }

  private useFallback(): boolean {
    if (typeof this.prisma.isConnected !== 'function') {
      return false;
    }
    return !this.prisma.isConnected();
  }

  private getOrCreateMemoryStation(identity: string): MemoryStationState {
    let station = this.memoryStations.get(identity);
    if (!station) {
      station = {
        id: randomUUID(),
        identity,
        vendor: null,
        model: null,
        serialNumber: null,
        firmwareVersion: null,
        endpoint: null,
        lastHeartbeatAt: new Date(),
        status: StationStatus.AVAILABLE,
        connectors: new Map(),
        transactions: new Map(),
      };
      this.memoryStations.set(identity, station);
    }
    return station;
  }

  private updateStationStatusFromConnectors(station: MemoryStationState) {
    const master = station.connectors.get(0);
    if (master) {
      station.status = this.deriveStationStatus(master.status);
      return;
    }

    for (const connector of station.connectors.values()) {
      if (connector.status === ConnectorStatus.CHARGING) {
        station.status = StationStatus.CHARGING;
        return;
      }
      if (connector.status === ConnectorStatus.FAULTED) {
        station.status = StationStatus.FAULTED;
      }
    }

    if (station.status !== StationStatus.FAULTED) {
      station.status = StationStatus.AVAILABLE;
    }
  }

  private buildStationRecord(station: MemoryStationState): StationRecord {
    return {
      id: station.id,
      ocppIdentity: station.identity,
      vendor: station.vendor,
      model: station.model,
      serialNumber: station.serialNumber,
      firmwareVersion: station.firmwareVersion,
      endpoint: station.endpoint,
      lastHeartbeatAt: station.lastHeartbeatAt,
      status: station.status,
    };
  }

  private async recordStationEvent(
    stationId: string,
    eventType: StationLogEvent,
    payload: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const repository = (
      this.prisma as unknown as {
        stationEventLog?: {
          create?: (args: Prisma.StationEventLogCreateArgs) => Promise<unknown>;
        };
      }
    ).stationEventLog;

    if (repository?.create === undefined) {
      return;
    }

    try {
      await repository.create({
        data: {
          stationId,
          eventType,
          payload: this.serialiseLogValue(payload),
          metadata:
            metadata === undefined
              ? undefined
              : this.serialiseLogValue(metadata),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to persist station event log for ${eventType}: ${message}`,
      );
    }
  }

  private serialiseLogValue(
    value: unknown,
  ): Prisma.JsonNullValueInput | Prisma.InputJsonValue {
    if (value === undefined) {
      return Prisma.JsonNull;
    }

    const json = JSON.stringify(value, (_key, val) => {
      if (val instanceof Date) {
        return val.toISOString();
      }
      if (typeof val === 'bigint') {
        return val.toString();
      }
      if (val instanceof Map) {
        return Object.fromEntries(val.entries());
      }
      return val;
    });

    if (json === undefined) {
      return Prisma.JsonNull;
    }

    return JSON.parse(json) as Prisma.InputJsonValue;
  }
}
