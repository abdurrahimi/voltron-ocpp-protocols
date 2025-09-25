// Configurations
import configuration from './app-configuration';

// NestJS Libraries
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';

// Services
import { AppConfigurationsService } from './app-configuration.service';

/**
 * Import and provide app configuration related classes.
 *
 * @module
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  providers: [ConfigService, AppConfigurationsService],
  exports: [ConfigService, AppConfigurationsService],
})
export class AppConfigurationModule {}
