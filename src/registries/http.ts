import { VERSION } from '../version.js';

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message = `HTTP ${status}`,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

export interface JsonResponse {
  status: number;
  body: unknown;
}

export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
}

const USER_AGENT = `pkgsift/${VERSION} (+https://github.com/YottaMeta/pkgsift)`;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<JsonResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });

      if (response.status === 404) return { status: 404, body: null };

      if (response.status === 429 || response.status >= 500) {
        lastError = new HttpStatusError(response.status);
        if (attempt < retries) {
          await sleep(backoffMs(attempt, response.headers.get('retry-after')));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) throw new HttpStatusError(response.status);

      return { status: response.status, body: await response.json() };
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      if (!retryable || attempt === retries) throw error;
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpStatusError) return error.status === 429 || error.status >= 500;
  return true;
}

function backoffMs(attempt: number, retryAfter: string | null = null): number {
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 5_000);
  }
  const base = 300 * 2 ** attempt;
  return base + Math.floor(Math.random() * 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
