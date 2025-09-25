import { StationStatus, TransactionStatus } from '@prisma/client';

import { StartTransactionPayload } from 'src/modules/ocpp/messages/schemas';

import { ChargingStationService } from './charging-station.service';

describe('ChargingStationService.handleStartTransaction', () => {
  const basePayload: StartTransactionPayload = {
    connectorId: 1,
    idTag: 'TEST-IDTAG',
    meterStart: 0,
    timestamp: new Date().toISOString(),
  };

  const configStub = {
    heartbeatIntervalSeconds: 300,
    offlineGracePeriodSeconds: 120,
    messageRetryIntervalSeconds: 60,
  } as const;

  const configService =
    configStub as unknown as import('src/configurations/ocpp/ocpp-configuration.service').OcppConfigurationService;

  it('returns an Accepted idTagInfo in fallback mode', async () => {
    const prismaFallbackStub = {
      isConnected: () => false,
      onConnectionStatusChange: () => () => undefined,
    } as unknown as import('src/modules/prisma/prisma.service').PrismaService;

    const service = new ChargingStationService(prismaFallbackStub, configService);

    const result = await service.handleStartTransaction('station-1', basePayload);

    expect(result).toEqual({
      transactionId: 1,
      idTagInfo: { status: 'Accepted' },
    });
  });

  it('returns an Accepted idTagInfo when using the database', async () => {
    const stationRecord = {
      id: 'station-db-id',
      ocppIdentity: 'station-1',
      vendor: null,
      model: null,
      serialNumber: null,
      firmwareVersion: null,
      endpoint: null,
      lastHeartbeatAt: new Date(),
      status: StationStatus.AVAILABLE,
    };

    const connectorRecord = { id: BigInt(10) };
    const transactionRecord = {
      id: BigInt(20),
      stationId: stationRecord.id,
      connectorId: connectorRecord.id,
      ocppConnectorId: basePayload.connectorId,
      idTag: basePayload.idTag,
      meterStart: basePayload.meterStart,
      startedAt: new Date(basePayload.timestamp),
      status: TransactionStatus.STARTED,
      reservationId: null,
    };

    const chargingStationFindUnique = jest.fn().mockResolvedValue(stationRecord);
    const chargingStationUpdate = jest.fn().mockResolvedValue(undefined);
    const chargingConnectorUpsert = jest.fn().mockResolvedValue(connectorRecord);
    const transactionCreate = jest
      .fn()
      .mockResolvedValue({ ...transactionRecord, stationId: stationRecord.id });
    const stationEventLogCreate = jest.fn().mockResolvedValue(undefined);

    const prismaDbStub = {
      isConnected: () => true,
      onConnectionStatusChange: () => () => undefined,
      chargingStation: {
        findUnique: chargingStationFindUnique,
        update: chargingStationUpdate,
      },
      chargingConnector: {
        upsert: chargingConnectorUpsert,
      },
      transaction: {
        create: transactionCreate,
      },
      stationEventLog: {
        create: stationEventLogCreate,
      },
    } as unknown as import('src/modules/prisma/prisma.service').PrismaService;

    const service = new ChargingStationService(prismaDbStub, configService);

    const result = await service.handleStartTransaction('station-1', basePayload);

    expect(result).toEqual({
      transactionId: Number(transactionRecord.id),
      idTagInfo: { status: 'Accepted' },
    });

    expect(chargingStationFindUnique).toHaveBeenCalledWith({
      where: { ocppIdentity: 'station-1' },
    });
    expect(chargingStationUpdate).toHaveBeenCalledWith({
      where: { id: stationRecord.id },
      data: { status: StationStatus.CHARGING },
    });
    expect(chargingConnectorUpsert).toHaveBeenCalled();
    expect(transactionCreate).toHaveBeenCalled();
    expect(stationEventLogCreate).toHaveBeenCalled();
  });
});
