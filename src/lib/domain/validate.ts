/**
 * Small validation helpers shared by the schemas.
 * Kept separate so `schema.ts` stays readable.
 */
import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Full timestamp, e.g. 2026-01-31T09:12:00.000Z */
export const isoTimestamp = z.string().refine(isIsoTimestamp, 'Expected an ISO 8601 timestamp');

/** Date only, e.g. 2026-02-01 (used for deadlines and start dates that have no time part). */
export const isoDate = z.string().refine(isIsoDate, 'Expected an ISO 8601 date (YYYY-MM-DD)');

export const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && isIsoDate(value) ? value : undefined));

export const optionalIsoTimestamp = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && isIsoTimestamp(value) ? value : undefined));

/** Normalize arbitrary date input (date-only, timestamp or parseable string) to a date-only string. */
export function toIsoDateOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (isIsoDate(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (parsed.getUTCFullYear() < 1990 || parsed.getUTCFullYear() > 2100) return undefined;
  return parsed.toISOString().slice(0, 10);
}

/** Clamp helper used by the scoring code. */
export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
