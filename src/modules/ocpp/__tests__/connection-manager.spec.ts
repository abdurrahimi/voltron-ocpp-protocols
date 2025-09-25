type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

import { ConnectionManager } from '../connection/connection-manager';

type MockSocket = {
  close: jest.Mock;
} & Record<string, unknown>;

const createMockSocket = (): MockSocket => {
  const socket: Partial<Mutable<MockSocket>> = {
    close: jest.fn(),
  };
  return socket as MockSocket;
};

describe('ConnectionManager', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('registers a new connection and tracks metadata', () => {
    const manager = new ConnectionManager();
    const socket = createMockSocket();

    const context = manager.registerConnection('STATION-1', socket as any);

    expect(context.identity).toBe('STATION-1');
    expect(context.socket).toBe(socket);
    expect(context.status).toBe('CONNECTED');
    expect(manager.getContext('STATION-1')).toBe(context);
  });

  it('replaces existing sockets when a station reconnects', () => {
    const manager = new ConnectionManager();
    const firstSocket = createMockSocket();
    manager.registerConnection('STATION-2', firstSocket as any);

    const secondSocket = createMockSocket();
    const context = manager.registerConnection(
      'STATION-2',
      secondSocket as any,
    );

    expect(firstSocket.close).toHaveBeenCalled();
    expect(context.socket).toBe(secondSocket);
    expect(manager.getContext('STATION-2')?.socket).toBe(secondSocket);
  });

  it('marks a connection as disconnected', () => {
    const manager = new ConnectionManager();
    const socket = createMockSocket();
    manager.registerConnection('STATION-3', socket as any);

    manager.markDisconnected(socket as any);

    expect(manager.getContext('STATION-3')?.status).toBe('DISCONNECTED');
  });

  it('closes sockets on application shutdown', () => {
    const manager = new ConnectionManager();
    const socketA = createMockSocket();
    const socketB = createMockSocket();

    manager.registerConnection('A', socketA as any);
    manager.registerConnection('B', socketB as any);

    manager.onApplicationShutdown();

    expect(socketA.close).toHaveBeenCalledWith(1001, 'Server shutdown');
    expect(socketB.close).toHaveBeenCalledWith(1001, 'Server shutdown');
  });
});
