export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  factor: number;
}

const defaultOptions: RetryOptions = {
  maxAttempts: 3,
  delayMs: 2000,
  factor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = defaultOptions,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<T> {
  let lastError: Error = new Error('No attempts made');
  let delay = options.delayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < options.maxAttempts) {
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        await sleep(delay);
        delay *= options.factor;
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
