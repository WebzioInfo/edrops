import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';

export function Idempotent() {
  return applyDecorators(UseInterceptors(IdempotencyInterceptor));
}
