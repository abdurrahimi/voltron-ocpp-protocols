import {
  ChargingStation,
  ConnectorStatus,
  PrismaClient,
  StationStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const station: ChargingStation = await prisma.chargingStation.upsert({
    where: { ocppIdentity: 'DEMO-STATION' },
    update: {},
    create: {
      ocppIdentity: 'DEMO-STATION',
      vendor: 'OpenAI',
      model: 'VirtualCS-1',
      serialNumber: 'VCS-001',
      firmwareVersion: '1.0.0',
      status: StationStatus.AVAILABLE,
      lastHeartbeatAt: new Date(),
    },
  });

  await prisma.chargingConnector.upsert({
    where: {
      stationId_ocppConnectorId: {
        stationId: station.id,
        ocppConnectorId: 1,
      },
    },
    update: {
      status: ConnectorStatus.AVAILABLE,
      errorCode: 'NoError',
      statusTimestamp: new Date(),
    },
    create: {
      stationId: station.id,
      ocppConnectorId: 1,
      status: ConnectorStatus.AVAILABLE,
      errorCode: 'NoError',
      statusTimestamp: new Date(),
    },
  });

  await prisma.chargingConnector.upsert({
    where: {
      stationId_ocppConnectorId: {
        stationId: station.id,
        ocppConnectorId: 2,
      },
    },
    update: {
      status: ConnectorStatus.AVAILABLE,
      errorCode: 'NoError',
      statusTimestamp: new Date(),
    },
    create: {
      stationId: station.id,
      ocppConnectorId: 2,
      status: ConnectorStatus.AVAILABLE,
      errorCode: 'NoError',
      statusTimestamp: new Date(),
    },
  });

  console.log('Seeded demo charging station with two connectors');
}

main()
  .catch((error) => {
    console.error('Failed to seed database', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
