import { evaluationResponseSchema } from '@/lib/domain/schema';
import { AppError, errorMessage } from '@/lib/util/errors';
import { truncate } from '@/lib/util/text';
import { buildEvaluationMessages, extractJsonObject } from './prompt';
import type { AiEvaluationProvider, EvaluationDraft, EvaluationInput } from './provider';

/**
 * Pollinations.ai evaluation provider.
 *
 * Pollinations exposes an OpenAI compatible chat-completions API. Two endpoints matter:
 *
 *   https://text.pollinations.ai/openai               free "anonymous" tier, no API key needed
 *   https://gen.pollinations.ai/v1/chat/completions   HTTP gateway, requires a key
 *
 * The default in `defaults.ts` targets the free tier so the app works out of the box; both
 * are configurable at runtime through Settings, and POLLINATIONS_API_KEY is added as a
 * bearer token when present (server side only, never sent to the browser).
 *
 * Design rules implemented here:
 *  - strict timeout, so a hung provider cannot hold a serverless function open
 *  - JSON-only output with one repair attempt, then a clear typed error
 *  - every response is validated against a Zod schema before it reaches the database
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PollinationsOptions {
  apiKey?: string | null;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: unknown };
    text?: unknown;
  }>;
  error?: { message?: string; code?: string | number } | string;
}

function contentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text);
        return '';
      })
      .join('');
  }
  return '';
}

export class PollinationsEvaluationProvider implements AiEvaluationProvider {
  readonly id = 'pollinations';
  readonly model: string;

  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly modelName: string,
    options: PollinationsOptions = {},
  ) {
    this.model = modelName;
    this.apiKey = options.apiKey ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async evaluateInternship(input: EvaluationInput): Promise<EvaluationDraft> {
    const { system, user } = buildEvaluationMessages(input);
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    const first = await this.requestCompletion(input, messages);
    const parsed = this.validate(first.content);
    if (parsed.ok) return this.toDraft(parsed.data, first.content);

    // One repair attempt: hand the model its own invalid output plus the schema problem.
    const repairMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: truncate(first.content, 2000) },
      {
        role: 'user',
        content: [
          'That response could not be parsed as the required JSON object.',
          `Validation error: ${parsed.error}`,
          'Return the same evaluation again as a single valid JSON object, with no markdown and no extra text.',
          'Required top level keys: criteria (array of {key, score, comment}), reasons, concerns, recommendation, summary.',
        ].join(' '),
      },
    ];

    const second = await this.requestCompletion(input, repairMessages);
    const repaired = this.validate(second.content);
    if (repaired.ok) return this.toDraft(repaired.data, second.content);

    throw new AppError(
      'AI_INVALID_RESPONSE',
      `The AI provider returned a response we could not validate (${repaired.error}). The internship was kept; try again.`,
      { retryable: true, details: truncate(second.content, 500) },
    );
  }

  private validate(
    text: string,
  ):
    | { ok: true; data: ReturnType<typeof evaluationResponseSchema.parse> }
    | { ok: false; error: string } {
    const json = extractJsonObject(text);
    if (!json) return { ok: false, error: 'no JSON object found in the response' };
    const result = evaluationResponseSchema.safeParse(json);
    if (result.success) return { ok: true, data: result.data };
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'schema mismatch',
    };
  }

  private toDraft(
    data: {
      criteria: Array<{ key: string; score: number; comment?: string }>;
      reasons: string[];
      concerns: string[];
      recommendation: EvaluationDraft['recommendation'];
      summary: string;
    },
    raw: string,
  ): EvaluationDraft {
    return {
      modelCriteria: data.criteria,
      reasons: data.reasons,
      concerns: data.concerns,
      recommendation: data.recommendation,
      summary: data.summary,
      raw: truncate(raw, 4000),
    };
  }

  private async requestCompletion(
    input: EvaluationInput,
    messages: ChatMessage[],
  ): Promise<{ content: string }> {
    const { settings } = input;
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      response_format: { type: 'json_object' },
      // Pollinations specific hints: keep prompts out of the public feed.
      private: true,
      referrer: 'internship-scout',
    };

    let response: Response;
    try {
      response = await this.fetchImpl(settings.baseUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(settings.timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      const name = (error as Error).name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new AppError(
          'UPSTREAM_TIMEOUT',
          `Pollinations did not answer within ${Math.round(settings.timeoutMs / 1000)}s.`,
          { retryable: true },
        );
      }
      throw new AppError('UPSTREAM_UNAVAILABLE', `Could not reach Pollinations: ${errorMessage(error)}`, {
        retryable: true,
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'UPSTREAM_AUTH',
        'Pollinations rejected the request (401/403). Check POLLINATIONS_API_KEY, or switch the base URL back to the free text.pollinations.ai endpoint.',
      );
    }
    if (response.status === 429) {
      throw new AppError(
        'UPSTREAM_RATE_LIMITED',
        'Pollinations rate limited this instance. Wait a moment, lower the concurrency in Settings, or add an API key.',
        { retryable: true },
      );
    }
    if (!response.ok && response.status >= 500) {
      throw new AppError('UPSTREAM_UNAVAILABLE', `Pollinations is unavailable (HTTP ${response.status}).`, {
        retryable: true,
      });
    }
    if (!response.ok) {
      const errorText = await safeText(response);
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        `Pollinations returned HTTP ${response.status}${errorText ? `: ${truncate(errorText, 200)}` : ''}`,
      );
    }

    const text = await safeText(response);
    let payload: ChatCompletionResponse;
    try {
      payload = JSON.parse(text) as ChatCompletionResponse;
    } catch {
      // The legacy text endpoint can answer with plain text instead of a JSON envelope.
      if (text.trim().length > 0) return { content: text };
      throw new AppError('AI_INVALID_RESPONSE', 'Pollinations returned an empty response.', {
        retryable: true,
      });
    }

    if (payload.error) {
      const message =
        typeof payload.error === 'string' ? payload.error : (payload.error.message ?? 'unknown error');
      throw new AppError('UPSTREAM_UNAVAILABLE', `Pollinations error: ${truncate(message, 200)}`, {
        retryable: true,
      });
    }

    const content =
      contentToString(payload.choices?.[0]?.message?.content) || contentToString(payload.choices?.[0]?.text);
    if (content.trim().length === 0) {
      throw new AppError('AI_INVALID_RESPONSE', 'Pollinations returned an empty message.', { retryable: true });
    }
    return { content };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw new AppError(
      'UPSTREAM_UNAVAILABLE',
      `Could not read the Pollinations response: ${errorMessage(error)}`,
    );
  }
}
