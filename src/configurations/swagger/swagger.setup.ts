// NestJS Libraries
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

// Services
import { AppConfigurationsService } from '../app/app-configuration.service';

export const swaggerSetup = (
  app: INestApplication,
  appConfiguration: AppConfigurationsService,
) => {
  /**
   * Swagger Config
   * https://docs.nestjs.com/openapi/introduction
   */
  const configurationOfDocument = new DocumentBuilder()
    .setTitle(appConfiguration.appName)
    .setDescription('List of API(s)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, configurationOfDocument);
  SwaggerModule.setup('docs', app, document);
};
