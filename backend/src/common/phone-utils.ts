import { parsePhoneNumberFromString, PhoneNumber } from 'libphonenumber-js';

/**
 * Normalizes any phone number into canonical E.164 format (+919876543210).
 * Defaults to 'IN' (India) country code if not provided in raw number.
 * Returns null if invalid.
 */
export function normalizePhoneNumber(
  rawPhone: string | null | undefined,
  defaultCountry: string = 'IN',
): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry as any);
    if (parsed && parsed.isValid()) {
      return parsed.number; // e.g. +919876543210
    }
  } catch {}

  // Fallback cleaner for common Indian number formats:
  // e.g. "98765 43210", "09876543210", "919876543210", "+91-9876543210"
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Validates whether a phone number is a valid telephone number.
 */
export function isValidPhoneNumber(
  rawPhone: string | null | undefined,
  defaultCountry: string = 'IN',
): boolean {
  if (!rawPhone || typeof rawPhone !== 'string') return false;
  return Boolean(normalizePhoneNumber(rawPhone, defaultCountry));
}

/**
 * Checks whether an input string looks like an email address.
 */
export function isEmailIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') return false;
  const trimmed = identifier.trim();
  return trimmed.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
