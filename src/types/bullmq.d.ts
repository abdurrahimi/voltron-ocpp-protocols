declare module '@nestjs/bullmq' {
  export const Processor: any;
  export const WorkerHost: any;
  export const OnWorkerEvent: any;
  export const InjectQueue: any;
  export const BullModule: any;
}

declare module 'bullmq' {
  export class Queue {
    add(name: string, data: any): Promise<any>;
  }
  export class Job<T = any> {
    data: T;
  }
}
