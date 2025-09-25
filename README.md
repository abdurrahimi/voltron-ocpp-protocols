# OCPP 1.6j Microservice

A TypeScript/NestJS microservice that implements the OCPP 1.6j protocol for managing electric vehicle charging stations. The service provides a standards-compliant WebSocket endpoint, robust connection management, persistent queuing for server-initiated messages, and a TimescaleDB-backed schema optimised for high-frequency meter data.

## ✨ Features

- **OCPP 1.6j WebSocket server** supporting `BootNotification`, `Heartbeat`, `StatusNotification`, `StartTransaction`, `StopTransaction`, and `MeterValues` messages.
- **Connection management** with reconnection handling, per-station state tracking, and graceful shutdown of sockets.
- **Durable message queue** for server-initiated commands that automatically flushes when a charging station reconnects.
- **PostgreSQL 17 + TimescaleDB** schema with hypertables, compression, columnar archival storage, and continuous aggregates tailored for high-volume meter data ingestion.
- **Comprehensive validation** with lightweight custom schema guards and explicit protocol error mapping.
- **Automated tests** covering message handling, database interactions, connection lifecycle, and queueing logic.
- **Docker Compose** stack providing the API service and a TimescaleDB instance ready for development or demos.

## 🧱 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NestJS Application                       │
│                                                                 │
│  ┌────────────────┐     ┌────────────────┐   ┌─────────────────┐│
│  │ OcppWebSocket  │ ◀──│ ConnectionMgr  │──▶│ Station Messages││
│  └──────┬─────────┘     └────────────────┘   └─────────────────┘│
│         │                        ▲                              │
│         ▼                        │                              │
│    OcppService ─────────────▶ ChargingStationService           │
│         ▲                        │                              │
│         │                        ▼                              │
│   Custom Validation         Prisma ORM / TimescaleDB            │
└─────────────────────────────────────────────────────────────────┘
```

- **OcppWebSocketServer** exposes the WebSocket endpoint at `/v1/ocpp/:identity`, performs low-level WebSocket handshakes, and orchestrates request/response flow.
- **OcppService** handles message routing, validation, protocol-specific responses, and error mapping.
- **ConnectionManager** keeps track of every connected station, handles reconnection replacement, and guarantees graceful shutdown.
- **ChargingStationService** encapsulates all persistence logic (stations, connectors, transactions, meter values) using Prisma + TimescaleDB features.
- **StationMessageService** provides a durable queue for server-initiated CALL messages that are dispatched once a station is online.

## 🗄️ Database Design

The schema is implemented via Prisma with a raw SQL migration (`prisma/migrations/20250101000000_init/migration.sql`) that enables TimescaleDB capabilities.

### Tables

| Table | Purpose | Key Indexes / Notes |
| ----- | ------- | ------------------- |
| `charging_stations` | Metadata and last-seen heartbeat per station | Unique index on `ocpp_identity` for fast lookup |
| `charging_connectors` | Per-connector status, error code, and telemetry | Unique `(station_id, ocpp_connector_id)` ensures idempotent updates |
| `transactions` | Charging sessions with start/stop meters and reasons | Index on `(station_id, status)` accelerates open session queries |
| `meter_values` | High-frequency sampled values | Hypertable on `sampled_at`, custom index `(station_id, sampled_at DESC)`, compression after 7 days |
| `meter_values_hourly` | Continuous aggregate for analytics | Automatically refreshed every 15 minutes |
| `meter_values_archive` | Columnar, compressed archive for long-term storage | 30-day chunks with columnar scans for reporting |
| `station_messages` | Persistent queue of outbound CALL messages | Index on `(station_id, status)` for fast dispatch |

### TimescaleDB Optimisations

- `meter_values` is converted to a **hypertable** with 1-day chunks and compression policies for warm data.
- `meter_values_hourly` uses **continuous aggregates** to deliver real-time analytics without heavy ad-hoc queries.
- `meter_values_archive` leverages **columnar storage** for long-retention datasets and is compressed to minimise storage cost.
- All high-cardinality lookups (station + timestamp, station + status) are backed by composite indexes.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker & Docker Compose (for the database and optional app runtime)

### Local Development

```bash
cp .env.example .env
npm install
npm run db:generate
npm run build # optional, triggers type-checking
```

Provision PostgreSQL 17 with TimescaleDB locally (or use Docker as shown below) and update `DATABASE_URL` in `.env` if needed.

Apply the schema and seed demo data:

```bash
npm run db:migrate
npm run db:seed
```

Start the service in development mode:

```bash
npm run start
```

The WebSocket endpoint will be available at `ws://localhost:3000/ocpp/{stationIdentity}`.

### Docker Compose

```bash
docker-compose up --build
```

This command starts:

- `api`: the NestJS OCPP microservice (port `3000`)
- `db`: PostgreSQL 17 with TimescaleDB, initialised with the required extensions

The API container automatically runs `prisma migrate deploy` before launching the service.

## 🔌 Using the OCPP Simulator

1. Start the microservice (locally or via Docker).
2. Open [https://ocpp-simulator.vercel.app/](https://ocpp-simulator.vercel.app/).
3. Configure the simulator URL to `ws://localhost:3000/ocpp/DEMO-STATION` (or the identity of your choice).
4. Trigger the **Boot Notification**; the station will be registered and the connection state becomes active.
5. Send `Heartbeat`, `StartTransaction`, `MeterValues`, and `StopTransaction` messages to verify end-to-end processing.
6. Use the simulator’s reconnect button to observe message queue replay behaviour.

## 🧪 Testing

Run the unit test suite:

```bash
npm test
```

The tests cover:

- Message routing and schema validation in `OcppService`.
- Database mutations performed by `ChargingStationService` using Prisma mocks.
- Connection lifecycle management (reconnection and shutdown).
- Persistent queue operations in `StationMessageService`.

## 📂 Project Structure

```
src/
├── app.module.ts
├── main.ts
├── configurations/
│   └── ocpp/                  # Environment-bound OCPP settings
├── modules/
│   └── ocpp/
│       ├── connection/        # Connection manager & types
│       ├── messages/          # Schema guards for OCPP payloads
│       ├── services/          # Charging station & message queue services
│       ├── ocpp.websocket.ts  # WebSocket entry point
│       └── ocpp.service.ts    # Core OCPP protocol logic
└── prisma/
    └── prisma.service.ts
```

## 🛠️ Tooling & Scripts

| Command | Description |
| ------- | ----------- |
| `npm run start` | Start NestJS in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed demo charging station and connectors |
| `npm test` | Run Jest unit tests |

## 📄 License

This project is provided as-is for demonstration purposes. Adapt and extend it to fit your production requirements.
