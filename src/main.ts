// Class Validator
import { useContainer } from 'class-validator';

// Compression
import * as compression from 'compression';

// Interceptors
import { CustomBaseResponseInterceptor } from './common/interceptors/base-response.interceptor';
import { ContextInterceptor } from './common/interceptors/context.interceptor';

// Modules
import { AppModule } from './app.module';

// NestJS Libraries
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';

// Services
import { AppConfigurationsService } from './configurations/app/app-configuration.service';

// Setups
import { swaggerSetup } from './configurations/swagger/swagger.setup';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);

  // Get app config for cors settings and starting the app.
  const appConfigurations: AppConfigurationsService = app.get(
    AppConfigurationsService,
  );

  /**
   * Global Prefix
   */
  app.setGlobalPrefix('/api');

  /**
   * Set Swagger
   */
  swaggerSetup(app, appConfigurations);

  /**
   * Global Serializer
   */
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new CustomBaseResponseInterceptor());
  app.useGlobalInterceptors(new ContextInterceptor());

  /**
   * Global Validation
   */
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  /**
   * https://dev.to/avantar/custom-validation-with-database-in-nestjs-gao
   */
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  /**
   * Enable Compression
   * Compression can greatly decrease the size of the response body, thereby increasing the speed of a web app.
   * https://docs.nestjs.com/techniques/compression
   */
  app.use(compression());

  /**
   * Enable Cors
   */
  app.enableCors();

  await app.enableShutdownHooks();

  await app.listen(appConfigurations.appPort, appConfigurations.appHost, () => {
    console.log(
      `[${appConfigurations.appName} ${appConfigurations.appEnv}]`,
      `Server running at http://${appConfigurations.appHost}:${appConfigurations.appPort}`,
    );
  });
}
bootstrap();
