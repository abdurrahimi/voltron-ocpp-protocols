import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { OcppConfigurationModule } from 'src/configurations/ocpp/ocpp-configuration.module';

import { OcppService } from './ocpp.service';
import { OcppWebSocketServer } from './ocpp.websocket';
import { ChargingStationService } from './services/charging-station.service';
import { ConnectionManager } from './connection/connection-manager';
import { StationMessageService } from './services/station-message.service';

@Module({
  imports: [PrismaModule, OcppConfigurationModule],
  providers: [
    OcppService,
    OcppWebSocketServer,
    ChargingStationService,
    ConnectionManager,
    StationMessageService,
  ],
  exports: [ChargingStationService, ConnectionManager, StationMessageService],
})
export class OcppModule {}
