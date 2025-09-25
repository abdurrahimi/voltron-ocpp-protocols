import { OcppCallError } from '../ocpp.errors';

export interface BootNotificationPayload {
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  chargeBoxSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterSerialNumber?: string;
  meterType?: string;
}

export interface AuthorizePayload {
  idTag: string;
}

export interface StatusNotificationPayload {
  connectorId: number;
  errorCode: string;
  status: string;
  timestamp?: string;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

export interface StartTransactionPayload {
  connectorId: number;
  idTag: string;
  meterStart: number;
  timestamp: string;
  reservationId?: number;
}

export interface StopTransactionPayload {
  transactionId: number;
  meterStop: number;
  timestamp: string;
  idTag?: string;
  reason?: string;
}

export interface MeterValueEntry {
  timestamp: string;
  sampledValue: SampledValue[];
}

export interface SampledValue {
  value: string;
  context?: string;
  format?: string;
  measurand?: string;
  phase?: string;
  location?: string;
  unit?: string;
}

export interface MeterValuesPayload {
  connectorId: number;
  transactionId?: number;
  meterValue: MeterValueEntry[];
}

const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

function ensureObject(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new OcppCallError(
      'TypeConstraintViolation',
      `Expected object for ${context}`,
    );
  }
  return value as Record<string, unknown>;
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OcppCallError(
      'TypeConstraintViolation',
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function ensureOptionalString(
  value: unknown,
  field = 'value',
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new OcppCallError(
      'TypeConstraintViolation',
      `${field} must be a string`,
    );
  }
  return value.trim().length === 0 ? undefined : value;
}

function ensureNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new OcppCallError(
      'TypeConstraintViolation',
      `${field} must be a number`,
    );
  }
  return value;
}

function ensureTimestamp(value: unknown, field: string): string {
  const timestamp = ensureString(value, field);
  if (!ISO_DATE_REGEX.test(timestamp)) {
    throw new OcppCallError(
      'PropertyConstraintViolation',
      `${field} must be an ISO-8601 timestamp`,
    );
  }

  if (/[+-]\d{2}:\d{2}$/.test(timestamp) || timestamp.endsWith('Z')) {
    return timestamp;
  }

  return `${timestamp}Z`;
}

export function parseBootNotification(
  payload: unknown,
): BootNotificationPayload {
  const data = ensureObject(payload, 'BootNotification');
  return {
    chargePointVendor: ensureString(
      data.chargePointVendor,
      'chargePointVendor',
    ),
    chargePointModel: ensureString(data.chargePointModel, 'chargePointModel'),
    chargePointSerialNumber: ensureOptionalString(
      data.chargePointSerialNumber,
      'chargePointSerialNumber',
    ),
    chargeBoxSerialNumber: ensureOptionalString(
      data.chargeBoxSerialNumber,
      'chargeBoxSerialNumber',
    ),
    firmwareVersion: ensureOptionalString(
      data.firmwareVersion,
      'firmwareVersion',
    ),
    iccid: ensureOptionalString(data.iccid, 'iccid'),
    imsi: ensureOptionalString(data.imsi, 'imsi'),
    meterSerialNumber: ensureOptionalString(
      data.meterSerialNumber,
      'meterSerialNumber',
    ),
    meterType: ensureOptionalString(data.meterType, 'meterType'),
  };
}

export function parseAuthorize(payload: unknown): AuthorizePayload {
  const data = ensureObject(payload, 'Authorize');
  return {
    idTag: ensureString(data.idTag, 'idTag'),
  };
}

export function parseStatusNotification(
  payload: unknown,
): StatusNotificationPayload {
  const data = ensureObject(payload, 'StatusNotification');
  return {
    connectorId: ensureNumber(data.connectorId, 'connectorId'),
    errorCode: ensureString(data.errorCode, 'errorCode'),
    status: ensureString(data.status, 'status'),
    timestamp: data.timestamp
      ? ensureTimestamp(data.timestamp, 'timestamp')
      : undefined,
    info: ensureOptionalString(data.info, 'info'),
    vendorId: ensureOptionalString(data.vendorId, 'vendorId'),
    vendorErrorCode: ensureOptionalString(
      data.vendorErrorCode,
      'vendorErrorCode',
    ),
  };
}

export function parseStartTransaction(
  payload: unknown,
): StartTransactionPayload {
  const data = ensureObject(payload, 'StartTransaction');
  return {
    connectorId: ensureNumber(data.connectorId, 'connectorId'),
    idTag: ensureString(data.idTag, 'idTag'),
    meterStart: ensureNumber(data.meterStart, 'meterStart'),
    timestamp: ensureTimestamp(data.timestamp, 'timestamp'),
    reservationId:
      data.reservationId === undefined
        ? undefined
        : ensureNumber(data.reservationId, 'reservationId'),
  };
}

export function parseStopTransaction(payload: unknown): StopTransactionPayload {
  const data = ensureObject(payload, 'StopTransaction');
  return {
    transactionId: ensureNumber(data.transactionId, 'transactionId'),
    meterStop: ensureNumber(data.meterStop, 'meterStop'),
    timestamp: ensureTimestamp(data.timestamp, 'timestamp'),
    idTag: ensureOptionalString(data.idTag, 'idTag'),
    reason: ensureOptionalString(data.reason, 'reason'),
  };
}

function parseSampledValue(value: unknown, index: number): SampledValue {
  const entry = ensureObject(value, `sampledValue[${index}]`);
  return {
    value: ensureString(entry.value, 'value'),
    context: ensureOptionalString(entry.context, 'context'),
    format: ensureOptionalString(entry.format, 'format'),
    measurand: ensureOptionalString(entry.measurand, 'measurand'),
    phase: ensureOptionalString(entry.phase, 'phase'),
    location: ensureOptionalString(entry.location, 'location'),
    unit: ensureOptionalString(entry.unit, 'unit'),
  };
}

function parseMeterValueEntry(value: unknown, index: number): MeterValueEntry {
  const entry = ensureObject(value, `meterValue[${index}]`);
  const sampledValue = Array.isArray(entry.sampledValue)
    ? entry.sampledValue.map((sample, sampleIndex) =>
        parseSampledValue(sample, sampleIndex),
      )
    : undefined;

  if (!sampledValue || sampledValue.length === 0) {
    throw new OcppCallError(
      'TypeConstraintViolation',
      'sampledValue must be a non-empty array',
    );
  }

  return {
    timestamp: ensureTimestamp(entry.timestamp, 'timestamp'),
    sampledValue,
  };
}

export function parseMeterValues(payload: unknown): MeterValuesPayload {
  const data = ensureObject(payload, 'MeterValues');
  const meterValues = Array.isArray(data.meterValue)
    ? data.meterValue.map((entry, index) => parseMeterValueEntry(entry, index))
    : undefined;

  if (!meterValues || meterValues.length === 0) {
    throw new OcppCallError(
      'TypeConstraintViolation',
      'meterValue must be a non-empty array',
    );
  }

  return {
    connectorId: ensureNumber(data.connectorId, 'connectorId'),
    transactionId:
      data.transactionId === undefined
        ? undefined
        : ensureNumber(data.transactionId, 'transactionId'),
    meterValue: meterValues,
  };
}
