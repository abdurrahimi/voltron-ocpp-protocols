// Configurations
import configuration from './jwt-configuration';

// NestJS Libraries
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Services
import { JwtConfigService } from './jwt-configuration.service';

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
  providers: [ConfigService, JwtConfigService],
  exports: [ConfigService, JwtConfigService],
})
export class JwtConfigModule {}
