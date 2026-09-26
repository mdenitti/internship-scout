/**
 * Browser side API helper. Keeps error handling in one place: every route handler answers
 * with `{ error: { code, message, retryable } }`, which becomes a typed `ApiError` here so
 * components can show the server's message verbatim instead of a generic failure.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.status = status;
    this.retryable = payload.retryable;
    this.details = payload.details;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
}

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text.trim().length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorPayload = (payload as { error?: ApiErrorPayload } | null)?.error;
    throw new ApiError(
      errorPayload ?? {
        code: `HTTP_${response.status}`,
        message: `Request failed with HTTP ${response.status}.`,
        retryable: response.status >= 500,
      },
      response.status,
    );
  }

  return payload as T;
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error.';
}
