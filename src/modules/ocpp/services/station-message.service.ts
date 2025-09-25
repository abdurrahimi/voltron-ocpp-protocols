import { Injectable, Logger } from '@nestjs/common';
import { MessageStatus, Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';

import { PrismaService } from 'src/prisma/prisma.service';

export interface QueueMessageInput {
  stationId: string;
  action: string;
  payload: Prisma.InputJsonValue;
  transactionId?: bigint;
  availableAt?: Date;
  uniqueId?: string;
}

interface MemoryMessage {
  id: string;
  stationId: string;
  action: string;
  payload: Prisma.InputJsonValue;
  uniqueId: string;
  status: MessageStatus;
  availableAt: Date | null;
  sentAt: Date | null;
  errorDetails: Prisma.InputJsonValue | null;
}

@Injectable()
export class StationMessageService {
  private readonly logger = new Logger(StationMessageService.name);
  private readonly memoryQueues = new Map<string, MemoryMessage[]>();

  constructor(private readonly prisma: PrismaService) {}

  async enqueueMessage(input: QueueMessageInput) {
    const uniqueId = input.uniqueId ?? uuid();

    if (this.useFallback()) {
      const message: MemoryMessage = {
        id: uuid(),
        stationId: input.stationId,
        action: input.action,
        payload: input.payload,
        uniqueId,
        status: MessageStatus.PENDING,
        availableAt: input.availableAt ?? null,
        sentAt: null,
        errorDetails: null,
      };
      const queue = this.memoryQueues.get(input.stationId) ?? [];
      queue.push(message);
      this.memoryQueues.set(input.stationId, queue);
      this.logger.debug(
        `Queued OCPP message ${uniqueId} for station ${input.stationId} in memory`,
      );
      return message;
    }

    const created = await this.prisma.stationMessage.create({
      data: {
        stationId: input.stationId,
        transactionId: input.transactionId ?? null,
        action: input.action,
        payload: input.payload,
        uniqueId,
        availableAt: input.availableAt ?? null,
        status: MessageStatus.PENDING,
      },
    });

    return created;
  }

  async listPendingMessages(stationId: string) {
    if (this.useFallback()) {
      const now = new Date();
      const queue = this.memoryQueues.get(stationId) ?? [];
      return queue.filter((message) => {
        if (message.status !== MessageStatus.PENDING) {
          return false;
        }
        if (!message.availableAt) {
          return true;
        }
        return message.availableAt <= now;
      });
    }

    return this.prisma.stationMessage.findMany({
      where: {
        stationId,
        status: MessageStatus.PENDING,
        OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async markAsDispatched(messageId: bigint | string) {
    if (this.useFallback()) {
      const id =
        typeof messageId === 'string' ? messageId : messageId.toString();
      for (const queue of this.memoryQueues.values()) {
        const message = queue.find((item) => item.id === id);
        if (message) {
          message.status = MessageStatus.DISPATCHED;
          message.sentAt = new Date();
          break;
        }
      }

      return;
    }

    const id = typeof messageId === 'string' ? BigInt(messageId) : messageId;
    await this.prisma.stationMessage.update({
      where: { id },
      data: {
        status: MessageStatus.DISPATCHED,
        sentAt: new Date(),
      },
    });
  }

  async markAsFailed(messageId: bigint | string, error: unknown) {
    if (this.useFallback()) {
      const id =
        typeof messageId === 'string' ? messageId : messageId.toString();
      for (const queue of this.memoryQueues.values()) {
        const message = queue.find((item) => item.id === id);
        if (message) {
          message.status = MessageStatus.FAILED;
          message.errorDetails = {
            error: error instanceof Error ? error.message : String(error),
          } as Prisma.InputJsonValue;
          break;
        }
      }

      return;
    }

    const id = typeof messageId === 'string' ? BigInt(messageId) : messageId;
    await this.prisma.stationMessage.update({
      where: { id },
      data: {
        status: MessageStatus.FAILED,
        errorDetails: {
          error: error instanceof Error ? error.message : String(error),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private useFallback(): boolean {
    return typeof this.prisma.isConnected === 'function'
      ? !this.prisma.isConnected()
      : false;
  }
}
