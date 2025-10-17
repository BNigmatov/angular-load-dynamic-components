import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SchemaGeneratorModule } from './schema-generator.module';
import { SchemaGeneratorService } from './schema-generator.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(SchemaGeneratorModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = appContext.get(SchemaGeneratorService);
    await service.run(process.argv.slice(2));
    Logger.log('Angular component files were generated successfully.', 'SchemaGenerator');
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await appContext.close();
  }
}

bootstrap();
