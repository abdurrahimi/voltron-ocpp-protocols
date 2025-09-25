// NestJS Libraries
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

/**
 * Service dealing with app config based operations.
 *
 * @class
 */
@Injectable()
export class DatabasePostgresConfigService {
  constructor(private readonly _configurationService: ConfigService) {}

  /**
   * @description Define getter for get database name
   */
  get databaseName(): string {
    return (
      this._configurationService.get<string>('databasePostgres.databaseName') ??
      'nestjs_boilerplate'
    );
  }

  /**
   * @description Define getter for get database host
   */
  get databaseHost(): string {
    return (
      this._configurationService.get<string>('databasePostgres.databaseHost') ??
      'localhost'
    );
  }

  /**
   * @description Define getter for get database user
   */
  get databaseUser(): string {
    return (
      this._configurationService.get<string>('databasePostgres.databaseUser') ??
      'root'
    );
  }

  /**
   * @description Define getter for get database password
   */
  get databasePassword(): string {
    return (
      this._configurationService.get<string>(
        'databasePostgres.databasePassword',
      ) ?? 'root'
    );
  }

  /**
   * @description Define getter for get database port
   */
  get databasePort(): number {
    return (
      this._configurationService.get<number>('databasePostgres.databasePort') ??
      5432
    );
  }

  /**
   * @description Define getter for get database sync
   */
  get databaseSync(): string {
    return (
      this._configurationService.get<string>('databasePostgres.databaseSync') ??
      'false'
    );
  }

  /**
   * @description Define getter for get database logging
   */
  get databaseLogging(): string {
    return (
      this._configurationService.get<string>(
        'databasePostgres.databaseLogging',
      ) ?? 'false'
    );
  }
}
