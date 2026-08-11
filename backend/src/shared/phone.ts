import { ApiError } from './api-error';

export function normalizeIndianPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const nationalNumber = digits.startsWith('91') && digits.length === 12
    ? digits.slice(2)
    : digits;

  if (!/^[6-9][0-9]{9}$/.test(nationalNumber)) {
    throw new ApiError(400, 'INVALID_PHONE', 'Enter a valid 10-digit Indian mobile number.');
  }

  return `+91${nationalNumber}`;
}

export function nationalPhone(phoneE164: string): string {
  return phoneE164.startsWith('+91') ? phoneE164.slice(3) : phoneE164;
}
