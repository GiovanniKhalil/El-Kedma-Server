/**
 * Unified, exact date-of-birth parsing and age calculation utilities.
 * Supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, and ISO date strings.
 */

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
};

function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS_MAP[d] ?? d);
}

export interface ParsedBirthDateParts {
  day: number;
  month: number;
  year?: number;
}

/**
 * Extracts day, month, and optional 4-digit year from any common date string format.
 */
export function parseBirthDateParts(
  birthDateStr?: string | Date | { seconds: number } | null,
  fallbackMonth?: number
): ParsedBirthDateParts {
  let day = 1;
  let month = fallbackMonth && fallbackMonth >= 1 && fallbackMonth <= 12 ? fallbackMonth : 1;
  let year: number | undefined = undefined;

  if (!birthDateStr) {
    return { day, month, year };
  }

  if (birthDateStr instanceof Date && !isNaN(birthDateStr.getTime())) {
    return {
      day: birthDateStr.getDate(),
      month: birthDateStr.getMonth() + 1,
      year: birthDateStr.getFullYear()
    };
  }

  if (typeof birthDateStr === 'object' && 'seconds' in birthDateStr && typeof birthDateStr.seconds === 'number') {
    const d = new Date(birthDateStr.seconds * 1000);
    if (!isNaN(d.getTime())) {
      return {
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear()
      };
    }
  }

  if (typeof birthDateStr !== 'string') {
    return { day, month, year };
  }

  // Normalize Arabic digits, trim, and strip ISO time / space time portion (e.g. T00:00:00.000Z)
  const normalized = normalizeDigits(birthDateStr).trim().split(/[T\s]/)[0];
  if (!normalized) {
    return { day, month, year };
  }

  const parts = normalized.split(/[-/.]/).filter(Boolean);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD or YYYY/MM/DD
        year = p0;
        month = p1;
        day = p2;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY or DD-MM-YYYY (with fallback if MM/DD/YYYY where middle > 12)
        year = p2;
        if (p1 > 12 && p0 >= 1 && p0 <= 12) {
          month = p0;
          day = p1;
        } else {
          day = p0;
          month = p1;
        }
      } else if (parts[2].length === 2) {
        const currentTwoDigitYear = new Date().getFullYear() % 100;
        year = p2 <= currentTwoDigitYear ? 2000 + p2 : 1900 + p2;
        if (p1 > 12 && p0 >= 1 && p0 <= 12) {
          month = p0;
          day = p1;
        } else {
          day = p0;
          month = p1;
        }
      }
    }
  }

  // Clamp/validate month & day
  if (month < 1 || month > 12 || isNaN(month)) {
    month = fallbackMonth && fallbackMonth >= 1 && fallbackMonth <= 12 ? fallbackMonth : 1;
  }
  if (day < 1 || day > 31 || isNaN(day)) {
    day = 1;
  }

  const currentYear = new Date().getFullYear();
  if (year !== undefined && (isNaN(year) || year < 1900 || year > currentYear)) {
    year = undefined;
  }

  return { day, month, year };
}

/**
 * Unified exact age calculation.
 * Computes (currentYear - birthYear) and subtracts 1 if the birthday has not occurred yet this year.
 */
export function calculateExactAge(
  birthDate?: string | Date | { seconds: number } | null,
  fallbackAge: number = 0
): number {
  if (!birthDate) return fallbackAge || 0;

  const { day, month, year } = parseBirthDateParts(birthDate);
  if (!year) {
    return fallbackAge || 0;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed
  const currentDay = today.getDate();

  let age = currentYear - year;
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }

  return age >= 0 ? age : (fallbackAge || 0);
}

/**
 * Backward-compatible alias for calculateExactAge.
 */
export const calculateDynamicAge = calculateExactAge;

export function isBirthdayToday(birthDate?: string, birthMonth?: number): boolean {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1;

  if (birthDate) {
    const { day, month } = parseBirthDateParts(birthDate, birthMonth);
    return month === currentMonth && day === currentDay;
  }

  if (birthMonth !== undefined) {
    return birthMonth === currentMonth && currentDay === 1;
  }

  return false;
}
