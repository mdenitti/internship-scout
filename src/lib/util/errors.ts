/**
 * Typed application errors. Every error carries a stable machine-readable code and a
 * message that is safe to show to a user, plus a `retryable` hint used by the UI.
 */

export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_AUTH'
  | 'AI_INVALID_RESPONSE'
  | 'STORAGE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  UPSTREAM_RATE_LIMITED: 503,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_AUTH: 502,
  AI_INVALID_RESPONSE: 502,
  STORAGE_ERROR: 500,
  CONFIGURATION_ERROR: 500,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, options?: { retryable?: boolean; details?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown, fallbackMessage = 'Something went wrong.'): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return new AppError('UPSTREAM_TIMEOUT', 'The provider took too long to respond.', { retryable: true });
    }
    return new AppError('INTERNAL', fallbackMessage, { details: error.message });
  }
  return new AppError('INTERNAL', fallbackMessage);
}

/** A single item failed, but the surrounding batch should continue. */
export function errorMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}
