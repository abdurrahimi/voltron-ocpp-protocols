import { ConnectionManager } from '../connection/connection-manager';
import { OcppService } from '../ocpp.service';

describe('OcppService', () => {
  const mockStationService = {
    handleBootNotification: jest.fn(),
    handleHeartbeat: jest.fn(),
    handleStatusNotification: jest.fn(),
    handleStartTransaction: jest.fn(),
    handleStopTransaction: jest.fn(),
    handleMeterValues: jest.fn(),
  };

  const connectionManager = new ConnectionManager();
  const service = new OcppService(mockStationService as any, connectionManager);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes BootNotification payloads and associates station', async () => {
    mockStationService.handleBootNotification.mockResolvedValue({
      stationId: 'station-1',
      response: {
        status: 'Accepted',
        currentTime: '2024-01-01T00:00:00Z',
        interval: 300,
      },
    });

    const message = JSON.stringify([
      2,
      'uid-1',
      'BootNotification',
      { chargePointVendor: 'OpenAI', chargePointModel: 'Virtual' },
    ]);

    const endpoint = '/v1/ocpp/IDENTITY';
    const result = await service.handleMessage('IDENTITY', message, endpoint);

    expect(mockStationService.handleBootNotification).toHaveBeenCalledWith(
      'IDENTITY',
      expect.objectContaining({ chargePointVendor: 'OpenAI' }),
      endpoint,
    );
    expect(result.reply).toEqual(
      JSON.stringify([
        3,
        'uid-1',
        {
          status: 'Accepted',
          currentTime: '2024-01-01T00:00:00Z',
          interval: 300,
        },
      ]),
    );
    expect(result.stationId).toBe('station-1');
    expect(result.flushPendingMessages).toBe(true);
  });

  it('handles Heartbeat messages', async () => {
    mockStationService.handleHeartbeat.mockResolvedValue({
      currentTime: '2024-01-01T00:00:00Z',
    });

    const result = await service.handleMessage(
      'IDENTITY',
      JSON.stringify([2, 'hb-1', 'Heartbeat', {}]),
    );

    expect(mockStationService.handleHeartbeat).toHaveBeenCalledWith('IDENTITY');
    expect(result.reply).toEqual(
      JSON.stringify([3, 'hb-1', { currentTime: '2024-01-01T00:00:00Z' }]),
    );
  });

  it('validates StatusNotification payloads', async () => {
    await expect(
      service.handleMessage(
        'IDENTITY',
        JSON.stringify([
          2,
          'status-1',
          'StatusNotification',
          { connectorId: 1, status: 'Available', errorCode: 'NoError' },
        ]),
      ),
    ).resolves.toBeDefined();

    expect(mockStationService.handleStatusNotification).toHaveBeenCalledWith(
      'IDENTITY',
      expect.objectContaining({ connectorId: 1, status: 'Available' }),
    );
  });

  it('routes StartTransaction and StopTransaction messages', async () => {
    mockStationService.handleStartTransaction.mockResolvedValue({
      transactionId: 42,
    });

    await service.handleMessage(
      'IDENTITY',
      JSON.stringify([
        2,
        'start-1',
        'StartTransaction',
        {
          connectorId: 1,
          idTag: 'TAG-1',
          meterStart: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ]),
    );

    expect(mockStationService.handleStartTransaction).toHaveBeenCalled();

    await service.handleMessage(
      'IDENTITY',
      JSON.stringify([
        2,
        'stop-1',
        'StopTransaction',
        {
          transactionId: 42,
          meterStop: 200,
          timestamp: '2024-01-01T01:00:00Z',
        },
      ]),
    );

    expect(mockStationService.handleStopTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 42 }),
    );
  });

  it('records MeterValues payloads', async () => {
    await service.handleMessage(
      'IDENTITY',
      JSON.stringify([
        2,
        'meter-1',
        'MeterValues',
        {
          connectorId: 1,
          transactionId: 42,
          meterValue: [
            {
              timestamp: '2024-01-01T00:00:00Z',
              sampledValue: [
                {
                  value: '10',
                  measurand: 'Energy.Active.Import.Register',
                },
              ],
            },
          ],
        },
      ]),
    );

    expect(mockStationService.handleMeterValues).toHaveBeenCalledWith(
      'IDENTITY',
      expect.objectContaining({ connectorId: 1 }),
    );
  });

  it('rejects unsupported actions', async () => {
    await expect(
      service.handleMessage(
        'IDENTITY',
        JSON.stringify([2, 'uid', 'ClearCache', {}]),
      ),
    ).rejects.toThrow('NotImplemented');
  });

  it('rejects malformed JSON payloads', async () => {
    await expect(service.handleMessage('IDENTITY', 'not-json')).rejects.toThrow(
      'FormationViolation',
    );
  });

  it('rejects non CALL messages', async () => {
    await expect(
      service.handleMessage('IDENTITY', JSON.stringify([3, 'uid', {}])),
    ).rejects.toThrow('NotSupported');
  });
});
