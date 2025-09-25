-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enumerated types matching Prisma schema
CREATE TYPE "StationStatus" AS ENUM (
  'AVAILABLE',
  'CHARGING',
  'FAULTED',
  'UNAVAILABLE',
  'OFFLINE',
  'FINISHING',
  'PREPARING',
  'RESERVED',
  'SUSPENDEDEV',
  'SUSPENDEDEVSE'
);

CREATE TYPE "ConnectorStatus" AS ENUM (
  'AVAILABLE',
  'PREPARING',
  'CHARGING',
  'SUSPENDEDEV',
  'SUSPENDEDEVSE',
  'FINISHING',
  'RESERVED',
  'UNAVAILABLE',
  'FAULTED'
);

CREATE TYPE "TransactionStatus" AS ENUM (
  'STARTED',
  'COMPLETED',
  'STOPPED',
  'ERRORED'
);

CREATE TYPE "MessageStatus" AS ENUM (
  'PENDING',
  'DISPATCHED',
  'FAILED'
);

CREATE TYPE "StationLogEvent" AS ENUM (
  'BOOT_NOTIFICATION',
  'HEARTBEAT',
  'STATUS_NOTIFICATION',
  'START_TRANSACTION',
  'STOP_TRANSACTION',
  'METER_VALUES'
);

-- Core tables
CREATE TABLE "charging_stations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ocppIdentity" TEXT NOT NULL,
  "status" "StationStatus" NOT NULL DEFAULT 'OFFLINE',
  "lastHeartbeatAt" TIMESTAMPTZ,
  "vendor" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "firmwareVersion" TEXT,
  "ocppVersion" TEXT NOT NULL DEFAULT '1.6',
  "endpoint" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "charging_stations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "charging_stations_ocppIdentity_key" UNIQUE ("ocppIdentity")
);

CREATE TABLE "charging_connectors" (
  "id" BIGSERIAL PRIMARY KEY,
  "stationId" UUID NOT NULL,
  "ocppConnectorId" INTEGER NOT NULL,
  "status" "ConnectorStatus" NOT NULL DEFAULT 'AVAILABLE',
  "errorCode" VARCHAR(100),
  "info" TEXT,
  "vendorErrorCode" TEXT,
  "statusTimestamp" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "station_connector_unique" UNIQUE ("stationId", "ocppConnectorId"),
  CONSTRAINT "charging_connectors_stationId_fkey"
    FOREIGN KEY ("stationId")
    REFERENCES "charging_stations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "transactions" (
  "id" BIGSERIAL PRIMARY KEY,
  "stationId" UUID NOT NULL,
  "connectorId" BIGINT,
  "ocppConnectorId" INTEGER NOT NULL,
  "idTag" TEXT NOT NULL,
  "meterStart" INTEGER NOT NULL,
  "meterStop" INTEGER,
  "startedAt" TIMESTAMPTZ NOT NULL,
  "stoppedAt" TIMESTAMPTZ,
  "reason" TEXT,
  "status" "TransactionStatus" NOT NULL DEFAULT 'STARTED',
  "reservationId" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "transactions_stationId_fkey"
    FOREIGN KEY ("stationId")
    REFERENCES "charging_stations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "transactions_connectorId_fkey"
    FOREIGN KEY ("connectorId")
    REFERENCES "charging_connectors" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX "transactions_station_status_idx"
  ON "transactions" ("stationId", "status");

CREATE TABLE "meter_values" (
  "id" BIGSERIAL PRIMARY KEY,
  "stationId" UUID NOT NULL,
  "connectorId" INTEGER NOT NULL,
  "transactionId" BIGINT,
  "sampledAt" TIMESTAMPTZ NOT NULL,
  "value" NUMERIC(18, 6) NOT NULL,
  "context" VARCHAR(100),
  "format" VARCHAR(50),
  "measurand" VARCHAR(100),
  "phase" VARCHAR(100),
  "location" VARCHAR(100),
  "unit" VARCHAR(30),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "meter_values_stationId_fkey"
    FOREIGN KEY ("stationId")
    REFERENCES "charging_stations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "meter_values_transactionId_fkey"
    FOREIGN KEY ("transactionId")
    REFERENCES "transactions" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX "meter_values_station_time_idx"
  ON "meter_values" ("stationId", "sampledAt");

CREATE INDEX "meter_values_transaction_idx"
  ON "meter_values" ("transactionId");

CREATE TABLE "station_messages" (
  "id" BIGSERIAL PRIMARY KEY,
  "stationId" UUID NOT NULL,
  "transactionId" BIGINT,
  "action" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "uniqueId" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
  "errorDetails" JSONB,
  "availableAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "station_messages_uniqueId_key" UNIQUE ("uniqueId"),
  CONSTRAINT "station_messages_stationId_fkey"
    FOREIGN KEY ("stationId")
    REFERENCES "charging_stations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "station_messages_transactionId_fkey"
    FOREIGN KEY ("transactionId")
    REFERENCES "transactions" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX "station_messages_status_idx"
  ON "station_messages" ("stationId", "status");

CREATE TABLE "station_event_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "stationId" UUID NOT NULL,
  "eventType" "StationLogEvent" NOT NULL,
  "payload" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "station_event_logs_stationId_fkey"
    FOREIGN KEY ("stationId")
    REFERENCES "charging_stations" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "station_event_logs_station_created_idx"
  ON "station_event_logs" ("stationId", "createdAt");

CREATE INDEX "station_event_logs_type_idx"
  ON "station_event_logs" ("stationId", "eventType", "createdAt");

-- TimescaleDB optimisations for meter data
SELECT create_hypertable('meter_values', 'sampledAt', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

ALTER TABLE "meter_values"
  SET (timescaledb.compress = TRUE,
       timescaledb.compress_segmentby = 'stationId',
       timescaledb.compress_orderby = 'sampledAt DESC');

SELECT add_compression_policy('meter_values', INTERVAL '7 days');

-- Continuous aggregate for hourly metrics
CREATE MATERIALIZED VIEW meter_values_hourly
WITH (timescaledb.continuous) AS
SELECT
  stationId,
  connectorId,
  time_bucket('1 hour', sampledAt) AS bucket,
  AVG(value) AS average_value,
  MAX(value) AS max_value,
  MIN(value) AS min_value,
  LAST(value, sampledAt) AS last_value
FROM
  meter_values
GROUP BY
  stationId,
  connectorId,
  bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'meter_values_hourly',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '15 minutes'
);

-- Columnar archive for long-term storage
CREATE TABLE meter_values_archive (
  stationId UUID NOT NULL,
  connectorId INTEGER NOT NULL,
  sampledAt TIMESTAMPTZ NOT NULL,
  value NUMERIC(18, 6) NOT NULL,
  transactionId BIGINT,
  context VARCHAR(100),
  format VARCHAR(50),
  measurand VARCHAR(100),
  phase VARCHAR(100),
  location VARCHAR(100),
  unit VARCHAR(30),
  createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stationId, connectorId, sampledAt)
) USING COLUMNAR;

SELECT add_compression_policy('meter_values_archive', INTERVAL '30 days');
