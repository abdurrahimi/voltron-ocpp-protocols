import { registerAs } from '@nestjs/config';

export default registerAs('ocpp', () => ({
  heartbeatIntervalSeconds: parseInt(
    process.env.OCPP_HEARTBEAT_INTERVAL ?? '300',
    10,
  ),
  offlineGracePeriodSeconds: parseInt(
    process.env.OCPP_OFFLINE_GRACE_PERIOD ?? '120',
    10,
  ),
  messageRetryIntervalSeconds: parseInt(
    process.env.OCPP_MESSAGE_RETRY_INTERVAL ?? '60',
    10,
  ),
}));
