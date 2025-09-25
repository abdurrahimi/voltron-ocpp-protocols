// NestJS Libraries
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

/**
 * Service dealing with app config based operations.
 *
 * @class
 */
@Injectable()
export class JwtConfigService {
  constructor(private readonly _configurationService: ConfigService) {}

  /**
   * @description Define getter for get jwt secret
   */
  get jwtSecret(): string {
    return (
      this._configurationService.get<string>('jwt.jwtSecret') ?? 'jwtSecret'
    );
  }

  /**
   * @description Define getter for get jwt exp
   */
  get jwtExp(): string {
    return this._configurationService.get<string>('jwt.jwtExp') ?? '1d';
  }

  /**
   * @description Define getter for get jwt issuer
   */
  get jwtIssuer(): string {
    return (
      this._configurationService.get<string>('jwt.jwtIssuer') ?? 'jwtIssuer'
    );
  }
}
