// NestJS Libraries
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

/**
 * Service dealing with app config based operations.
 *
 * @class
 */
@Injectable()
export class AppConfigurationsService {
  constructor(private readonly _configurationsService: ConfigService) {}

  /**
   * @description Define getter for get app name
   */
  get appName(): string {
    return (
      this._configurationsService.get<string>('app.appName') ??
      'NestJS Boilerplate'
    );
  }

  /**
   * @description Define getter for get app host
   */
  get appHost(): string {
    return (
      this._configurationsService.get<string>('app.appHost') ?? 'localhost'
    );
  }

  /**
   * @description Define getter for get app port
   */
  get appPort(): string {
    return this._configurationsService.get<string>('app.appPort') ?? '1337';
  }

  /**
   * @description Define getter for get app environment
   */
  get appEnv(): string {
    return (
      this._configurationsService.get<string>('app.appEnv') ?? 'development'
    );
  }

  /**
   * @description Define getter for get api external base url
   */
  get apiExternalBaseUrl(): string {
    return (
      this._configurationsService.get<string>('app.apiExternalBaseUrl') ??
      'https://google.com'
    );
  }
}
