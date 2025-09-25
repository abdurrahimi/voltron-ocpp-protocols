// Configuration Modules
import { AppConfigurationModule } from './configurations/app/app-configuration.module';
import { DatabasePostgresConfigModule } from './configurations/database/postgres/postgres-configuration.module';
import { OcppModule } from './modules/ocpp/ocpp.module';

// NestJS Libraries
import { Module } from '@nestjs/common';

@Module({
  imports: [
    // Configuration Modules
    AppConfigurationModule,
    DatabasePostgresConfigModule,

    // Core Feature Modules
    OcppModule,
  ],
})
export class AppModule {}
