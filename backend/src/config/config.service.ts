import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  /**
   * Retrieves an environment variable by key, returning optional default if absent or empty.
   */
  get<T = string>(key: string, defaultValue?: T): T {
    const val = process.env[key];
    if (val === undefined || val === '') {
      return defaultValue as T;
    }
    return val as unknown as T;
  }
}

