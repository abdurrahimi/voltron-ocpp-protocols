import { StationMessageService } from '../services/station-message.service';

import { PrismaService } from 'src/prisma/prisma.service';

describe('StationMessageService', () => {
  const prisma = {
    stationMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new StationMessageService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues outgoing messages with generated ids', async () => {
    (prisma.stationMessage.create as jest.Mock).mockResolvedValue({
      id: '1',
      uniqueId: 'uuid',
    });

    const result = await service.enqueueMessage({
      stationId: 'station-1',
      action: 'RemoteStartTransaction',
      payload: { connectorId: 1 },
    });

    expect(prisma.stationMessage.create).toHaveBeenCalled();
    expect(result.uniqueId).toBeDefined();
  });

  it('lists pending messages ordered by creation time', async () => {
    await service.listPendingMessages('station-1');

    expect(prisma.stationMessage.findMany).toHaveBeenCalledWith({
      where: {
        stationId: 'station-1',
        status: 'PENDING',
        OR: [{ availableAt: null }, { availableAt: { lte: expect.any(Date) } }],
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('marks messages as dispatched and failed', async () => {
    await service.markAsDispatched('1');
    await service.markAsFailed('2', new Error('boom'));

    expect(prisma.stationMessage.update).toHaveBeenNthCalledWith(1, {
      where: { id: BigInt('1') },
      data: { status: 'DISPATCHED', sentAt: expect.any(Date) },
    });

    expect(prisma.stationMessage.update).toHaveBeenNthCalledWith(2, {
      where: { id: BigInt('2') },
      data: {
        status: 'FAILED',
        errorDetails: { error: 'boom' },
      },
    });
  });
});
