// NestJS Libraries
import { registerAs } from '@nestjs/config';

export default registerAs('databasePostgres', () => ({
  databaseHost: process.env.DATABASE_HOST,
  databaseName: process.env.DATABASE_NAME,
  databaseUser: process.env.DATABASE_USER,
  databasePassword: process.env.DATABASE_PASSWORD,
  databasePort: process.env.DATABASE_PORT,
  databaseSync: process.env.DATABASE_SYNCHRONIZE,
  databaseLogging: process.env.DATABASE_LOGGING,
}));
