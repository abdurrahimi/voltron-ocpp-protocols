import configuration from './ocpp-configuration';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { OcppConfigurationService } from './ocpp-configuration.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  providers: [ConfigService, OcppConfigurationService],
  exports: [ConfigService, OcppConfigurationService],
})
export class OcppConfigurationModule {}
