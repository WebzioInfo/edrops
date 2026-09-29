import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure 4-digit numeric delivery verification OTP (1000-9999).
 */
export function generateDeliveryOtp(): string {
  return crypto.randomInt(1000, 10000).toString();
}
