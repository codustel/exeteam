import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global Zod validation pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // CORS - tighten in production
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`🚀 ExeTeam API running on port ${port}`, 'Bootstrap');
}

bootstrap();
