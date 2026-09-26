import { AppError, errorMessage } from '@/lib/util/errors';

/**
 * Shared HTTP helper for search providers.
 *
 * Every outbound request in the search layer goes through here so that timeouts, HTTP
 * status codes and malformed JSON are turned into one consistent, user friendly error
 * type. Providers therefore never leak raw fetch errors into the UI.
 */

export interface HttpRequestOptions {
  timeoutMs: number;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  fetchImpl?: typeof fetch;
  /** Name used in error messages, e.g. "Arbeitnow". */
  label: string;
}

async function request(url: string, options: HttpRequestOptions): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'internship-scout/0.1 (+https://github.com/internship-scout)',
        ...options.headers,
      },
      ...(options.body ? { body: options.body } : {}),
      signal: AbortSignal.timeout(options.timeoutMs),
      cache: 'no-store',
    });
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new AppError('UPSTREAM_TIMEOUT', `${options.label} did not respond in time.`, { retryable: true });
    }
    throw new AppError('UPSTREAM_UNAVAILABLE', `${options.label} is unreachable: ${errorMessage(error)}`, {
      retryable: true,
    });
  }

  if (response.status === 429) {
    throw new AppError('UPSTREAM_RATE_LIMITED', `${options.label} rate limited this instance.`, {
      retryable: true,
    });
  }
  if (!response.ok) {
    throw new AppError(
      'UPSTREAM_UNAVAILABLE',
      `${options.label} returned HTTP ${response.status}.`,
      { retryable: response.status >= 500 },
    );
  }
  return response;
}

export async function fetchJson<T>(url: string, options: HttpRequestOptions): Promise<T> {
  const response = await request(url, options);
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError('UPSTREAM_UNAVAILABLE', `${options.label} returned a non-JSON response.`, {
      retryable: true,
    });
  }
}

/**
 * Only used for APIs that are explicitly documented as JSON endpoints but may answer with
 * text (never for HTML scraping).
 */
export async function fetchText(url: string, options: HttpRequestOptions): Promise<string> {
  const response = await request(url, options);
  return response.text();
}

/** Guard for provider payloads: `unknown` in, typed object out, or a clear error. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}
