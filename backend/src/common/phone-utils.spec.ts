import { normalizePhoneNumber, isValidPhoneNumber, isEmailIdentifier } from './phone-utils';

describe('Phone Number Normalization Utility', () => {
  it('should normalize 10-digit Indian numbers to E.164 (+91...) format', () => {
    expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
  });

  it('should normalize numbers with country code (+919876543210)', () => {
    expect(normalizePhoneNumber('+919876543210')).toBe('+919876543210');
  });

  it('should normalize numbers with spaces and country code (+91 98765 43210)', () => {
    expect(normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210');
  });

  it('should normalize numbers with hyphens (+91-9876543210)', () => {
    expect(normalizePhoneNumber('+91-9876543210')).toBe('+919876543210');
  });

  it('should normalize numbers with leading zero (09876543210)', () => {
    expect(normalizePhoneNumber('09876543210')).toBe('+919876543210');
  });

  it('should normalize numbers with leading 91 without plus (919876543210)', () => {
    expect(normalizePhoneNumber('919876543210')).toBe('+919876543210');
  });

  it('should handle international numbers with country codes', () => {
    expect(normalizePhoneNumber('+1 202 555 0123')).toBe('+12025550123');
  });

  it('should return null for invalid phone numbers', () => {
    expect(normalizePhoneNumber('12345')).toBeNull();
    expect(normalizePhoneNumber('abc')).toBeNull();
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber(null as any)).toBeNull();
  });

  it('should validate phone numbers correctly', () => {
    expect(isValidPhoneNumber('9876543210')).toBe(true);
    expect(isValidPhoneNumber('+91 9876543210')).toBe(true);
    expect(isValidPhoneNumber('invalid')).toBe(false);
  });

  it('should distinguish email vs phone identifiers correctly', () => {
    expect(isEmailIdentifier('customer@example.com')).toBe(true);
    expect(isEmailIdentifier('CUSTOMER@EXAMPLE.COM')).toBe(true);
    expect(isEmailIdentifier('9876543210')).toBe(false);
    expect(isEmailIdentifier('+919876543210')).toBe(false);
  });
});
