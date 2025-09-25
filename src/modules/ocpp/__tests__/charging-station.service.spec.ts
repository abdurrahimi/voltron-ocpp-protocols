import { OcppConfigurationService } from 'src/configurations/ocpp/ocpp-configuration.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';

import { ChargingStationService } from '../services/charging-station.service';
import { OcppCallError } from '../ocpp.errors';

describe('ChargingStationService', () => {
  const prisma = {
    chargingStation: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    chargingConnector: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    meterValue: {
      createMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const config: Partial<OcppConfigurationService> = {
    heartbeatIntervalSeconds: 300,
  };

  const service = new ChargingStationService(
    prisma,
    config as OcppConfigurationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.chargingStation.upsert as jest.Mock).mockResolvedValue({
      id: 'station-1',
    });
    (prisma.chargingStation.findUnique as jest.Mock).mockResolvedValue({
      id: 'station-1',
    });
  });

  it('creates or updates stations during boot notification', async () => {
    const result = await service.handleBootNotification(
      'IDENTITY',
      {
        chargePointVendor: 'OpenAI',
        chargePointModel: 'Virtual',
      } as any,
      '/v1/ocpp/IDENTITY',
    );

    expect(prisma.chargingStation.upsert).toHaveBeenCalled();
    expect(result.response).toMatchObject({
      status: 'Accepted',
      interval: 300,
    });
  });

  it('throws when stopping an unknown transaction', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.handleStopTransaction({
        transactionId: 99,
        meterStop: 100,
        timestamp: new Date().toISOString(),
      } as any),
    ).rejects.toBeInstanceOf(OcppCallError);
  });

  it('persists meter values for every sampled value received', async () => {
    await service.handleMeterValues('IDENTITY', {
      connectorId: 1,
      meterValue: [
        {
          timestamp: new Date().toISOString(),
          sampledValue: [
            { value: '10', measurand: 'Energy.Active.Import.Register' },
            { value: '11', measurand: 'Current.Import' },
          ],
        },
      ],
    } as any);

    expect(prisma.meterValue.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ measurand: 'Energy.Active.Import.Register' }),
        expect.objectContaining({ measurand: 'Current.Import' }),
      ]),
    });
  });

  it('updates connector and station status during notifications', async () => {
    await service.handleStatusNotification('IDENTITY', {
      connectorId: 0,
      status: 'Available',
      errorCode: 'NoError',
    } as any);

    expect(prisma.chargingConnector.upsert).toHaveBeenCalled();
    expect(prisma.chargingStation.update).toHaveBeenCalled();
  });
});
