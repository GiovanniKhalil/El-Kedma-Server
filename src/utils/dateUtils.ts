/**
 * Date and Age calculation utilities for Church Service Platform
 */
import { calculateExactAge, parseBirthDateParts } from './ageUtils';

export interface ParsedBirthDate {
  day: number;
  month: number;
  year?: number;
}

/**
 * Extracts day, month, and optional birth year from string formats
 * Supports YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD, DD/MM/YYYY, and ISO strings
 */
export function parseFullBirthDate(birthDateStr?: string, fallbackMonth?: number): ParsedBirthDate {
  return parseBirthDateParts(birthDateStr, fallbackMonth);
}

/**
 * Calculates accurate age based on birthDate string or fallbackAge
 */
export function calculateAge(birthDateStr?: string, fallbackAge?: number): number {
  return calculateExactAge(birthDateStr, fallbackAge || 0);
}

export { calculateExactAge };

/**
 * Calculates days remaining until next birthday
 * Returns 0 if today, 1..365 for future days
 */
export function getDaysUntilBirthday(birthDateStr?: string, fallbackMonth?: number): number {
  const { day, month } = parseFullBirthDate(birthDateStr, fallbackMonth);
  const today = new Date();
  const currentYear = today.getFullYear();

  // Target birthday this year
  let nextBday = new Date(currentYear, month - 1, day);

  // Set time to midnight for accurate day comparison
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // If birthday already passed this year, look at next year
  if (nextBday.getTime() < todayMidnight.getTime()) {
    nextBday = new Date(currentYear + 1, month - 1, day);
  }

  const diffTime = nextBday.getTime() - todayMidnight.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if birthday is within the next N days (default: 7 days)
 */
export function isUpcomingBirthday(birthDateStr?: string, fallbackMonth?: number, withinDays = 7): boolean {
  const days = getDaysUntilBirthday(birthDateStr, fallbackMonth);
  return days >= 0 && days <= withinDays;
}
