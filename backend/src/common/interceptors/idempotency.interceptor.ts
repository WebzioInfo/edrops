import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    // If no key is provided, just continue normally for now
    if (!idempotencyKey) {
      return next.handle();
    }

    // Check if we already have this key
    const existingRecord = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingRecord) {
      // If it's still processing or failed, we can optionally reject it or just return the saved response
      // For now, if we have a successful response, return it directly
      if (existingRecord.status === 'SUCCESS' && existingRecord.response) {
        return of(existingRecord.response);
      }
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Save the successful response
        try {
          await this.prisma.idempotencyRecord.upsert({
            where: { key: idempotencyKey },
            update: {
              response: response,
              status: 'SUCCESS',
            },
            create: {
              key: idempotencyKey,
              response: response,
              status: 'SUCCESS',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
            },
          });
        } catch (error) {
          // Non-fatal if we can't save the idempotency record, but we should log it
          console.error('Failed to save idempotency record', error);
        }
      }),
    );
  }
}
