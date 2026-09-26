import { NextResponse } from 'next/server';

import { AppError, isAppError, toAppError } from './errors';
import { checkRateLimit, type RateLimitRule } from './rate-limit';

/**
 * Shared helpers for the route handlers: consistent JSON envelopes, input validation,
 * rate limiting and a client key that works behind the Vercel proxy.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(error: unknown): NextResponse<ApiErrorBody> {
  const appError = isAppError(error) ? error : toAppError(error);
  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      retryable: appError.retryable,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };

  const headers: Record<string, string> = {};
  const retryAfter = extractRetryAfter(appError.details);
  if (retryAfter) headers['retry-after'] = String(retryAfter);

  return NextResponse.json(body, { status: appError.status, headers });
}

function extractRetryAfter(details: unknown): number | null {
  if (details && typeof details === 'object' && 'retryAfterSeconds' in details) {
    const value = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    if (typeof value === 'number' && value > 0) return Math.ceil(value);
  }
  return null;
}

/** Best effort client identifier for rate limiting (per instance, best effort by design). */
export function clientKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return headers.get('x-real-ip') ?? 'local';
}

export function enforceRateLimit(request: Request, scope: string, rule: RateLimitRule): void {
  const result = checkRateLimit(`${scope}:${clientKey(request)}`, rule);
  if (result.allowed) return;
  throw new AppError('RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.', {
    retryable: true,
    details: { retryAfterSeconds: result.retryAfterSeconds },
  });
}

const MAX_BODY_BYTES = 1024 * 1024;

/** Read and parse a JSON body with a size guard. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new AppError('BAD_REQUEST', 'Request body is too large.');
  }
  const text = await request.text();
  if (text.trim().length === 0) return {};
  if (text.length > MAX_BODY_BYTES) throw new AppError('BAD_REQUEST', 'Request body is too large.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError('BAD_REQUEST', 'Request body must be valid JSON.');
  }
}

export function searchParamsFrom(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
