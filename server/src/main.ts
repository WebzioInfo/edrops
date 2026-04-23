import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Enable raw body parsing for Razorpay webhook signature verification
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log'],
  });

  // ─── Global prefix ───────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── CORS ────────────────────────────────────
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0
      ? allowedOrigins
      : [
          'http://localhost:3000',  // Next.js website (dev)
          'http://localhost:5173',  // Order app (dev)
          'http://localhost:5174',  // Dashboard (dev)
        ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ─── Security Headers ────────────────────────
  app.use(helmet());

  // ─── Global Validation Pipe ──────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // allows extra fields in body without throwing
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Start ───────────────────────────────────
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(
    `🚀 E-Drops API running on: http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
}
bootstrap();
