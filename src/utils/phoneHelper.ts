/**
 * Phone number normalization, validation, and deep-link helpers (Egypt & International).
 */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Converts Arabic/Persian numerals to ASCII digits and strips formatting whitespace/dashes.
 */
export function toAsciiDigits(input?: string | null): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

/**
 * Normalizes an Egyptian or international phone string.
 * - Converts +201..., 00201..., 201... -> 01XXXXXXXXX (11 digits)
 * - Strips spaces, dashes, and parentheses
 */
export function normalizeEgyptPhone(raw?: string | null): string {
  const ascii = toAsciiDigits(raw);
  if (!ascii) return '';

  const digits = ascii.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0020') && digits.length === 14) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith('20') && digits.length === 12 && digits[2] === '1') {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

/**
 * Checks whether the phone matches a valid 11-digit Egyptian mobile number (010, 011, 012, 015)
 * or a valid landline/international digit sequence of 8-15 digits.
 */
export function isValidEgyptPhone(raw?: string | null): boolean {
  const normalized = normalizeEgyptPhone(raw);
  if (!normalized) return false;
  if (/^01[0125][0-9]{8}$/.test(normalized)) return true;
  return /^[0-9]{8,15}$/.test(normalized);
}

/**
 * Formats an 11-digit Egyptian mobile number nicely (e.g. 012 3456 7890).
 */
export function formatPhoneDisplay(raw?: string | null): string {
  const normalized = normalizeEgyptPhone(raw);
  if (!normalized) return '';
  if (normalized.length === 11 && normalized.startsWith('01')) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3, 7)} ${normalized.slice(7)}`;
  }
  return normalized;
}

/**
 * Builds a safe tel: link or null if the phone is empty.
 */
export function getTelHref(raw?: string | null): string | null {
  const normalized = normalizeEgyptPhone(raw);
  return normalized ? `tel:${normalized}` : null;
}

/**
 * Builds a clean WhatsApp wa.me link without double country code prefixes.
 */
export function getWhatsAppHref(raw?: string | null, message?: string): string | null {
  const ascii = toAsciiDigits(raw);
  const digits = ascii.replace(/\D/g, '');
  if (!digits) return null;

  let waNumber = digits;
  if (digits.startsWith('00')) {
    waNumber = digits.slice(2);
  } else if (digits.startsWith('01') && digits.length === 11) {
    waNumber = `2${digits}`;
  } else if (digits.startsWith('1') && digits.length === 10) {
    waNumber = `20${digits}`;
  }

  const base = `https://wa.me/${waNumber}`;
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}
