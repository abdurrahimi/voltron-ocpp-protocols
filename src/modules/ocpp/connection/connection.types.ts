export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED';

export interface ConnectionContext {
  identity: string;
  socket: {
    close(code?: number, reason?: string): void;
  };
  connectedAt: Date;
  lastMessageAt: Date;
  status: ConnectionStatus;
  stationId?: string;
}

export interface OutgoingQueuedMessage {
  id: string;
  action: string;
  payload: unknown;
}
