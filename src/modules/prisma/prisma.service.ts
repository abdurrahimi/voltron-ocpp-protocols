import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private connecting = false;
  private readonly reconnectIntervalMs = 5_000;
  private readonly listeners = new Set<(connected: boolean) => void>();

  async onModuleInit() {
    await this.tryConnect();

    if (!this.connected) {
      this.scheduleReconnect();
    }
  }

  async onModuleDestroy() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.connected) {
      await this.$disconnect();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  onConnectionStatusChange(listener: (connected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyConnectionStatus(connected: boolean) {
    for (const listener of this.listeners) {
      try {
        listener(connected);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Connection status listener threw an error: ${message}`,
        );
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setInterval(() => {
      void this.tryConnect();
    }, this.reconnectIntervalMs);
  }

  private async tryConnect() {
    if (this.connected || this.connecting) {
      return;
    }

    this.connecting = true;
    try {
      const wasConnected = this.connected;
      await this.$connect();
      this.connected = true;
      this.logger.log('Connected to database');
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
      if (!wasConnected) {
        this.notifyConnectionStatus(true);
      }
    } catch (error) {
      this.connected = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Database connection unavailable: ${message}. Running in in-memory mode`,
      );
      this.scheduleReconnect();
      this.notifyConnectionStatus(false);
    } finally {
      this.connecting = false;
    }
  }
}
