import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OcppConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  get heartbeatIntervalSeconds(): number {
    return (
      this.configService.get<number>('ocpp.heartbeatIntervalSeconds') ?? 300
    );
  }

  get offlineGracePeriodSeconds(): number {
    return (
      this.configService.get<number>('ocpp.offlineGracePeriodSeconds') ?? 120
    );
  }

  get messageRetryIntervalSeconds(): number {
    return (
      this.configService.get<number>('ocpp.messageRetryIntervalSeconds') ?? 60
    );
  }
}
