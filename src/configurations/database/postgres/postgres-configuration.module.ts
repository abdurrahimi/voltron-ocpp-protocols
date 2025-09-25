// Configurations
import configuration from './postgres-configuration';

// NestJS Libraries
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Services
import { DatabasePostgresConfigService } from './postgres-configuration.service';

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
  providers: [ConfigService, DatabasePostgresConfigService],
  exports: [ConfigService, DatabasePostgresConfigService],
})
export class DatabasePostgresConfigModule {}
