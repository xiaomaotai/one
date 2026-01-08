/**
 * Retry Logic with Exponential Backoff
 * 
 * Implements retry mechanism for failed API requests and storage operations.
 * 
 * Requirements: 2.5
 */

import type { ApiError } from './api-errors';
import { isRetryableError } from './api-errors';

/** Retry configuration */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

/** Retry state */
export interface RetryState {
  attempt: number;
  lastError?: ApiError;
  nextDelayMs: number;
}

/**
 * Calculate delay for next retry with exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      const apiError = error as ApiError;
      const shouldRetry = attempt < fullConfig.maxRetries && 
        (apiError.retryable !== false || isRetryableError(apiError));
      
      if (!shouldRetry) {
        throw lastError;
      }

      // Calculate delay
      let delayMs = calculateBackoffDelay(attempt, fullConfig);
      
      // Use retry-after if provided
      if (apiError.retryAfter) {
        delayMs = Math.max(delayMs, apiError.retryAfter * 1000);
      }

      // Notify about retry
      onRetry?.(attempt + 1, lastError, delayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retryable wrapper for async functions
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), config);
  }) as T;
}

/**
 * Retry state manager for UI feedback
 */
export class RetryManager {
  private state: RetryState = {
    attempt: 0,
    nextDelayMs: 0
  };
  private config: RetryConfig;
  private onStateChange?: (state: RetryState) => void;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  setOnStateChange(callback: (state: RetryState) => void): void {
    this.onStateChange = callback;
  }

  getState(): RetryState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      attempt: 0,
      nextDelayMs: 0
    };
    this.onStateChange?.(this.state);
  }

  recordFailure(error: ApiError): boolean {
    this.state.attempt++;
    this.state.lastError = error;
    
    const canRetry = this.state.attempt <= this.config.maxRetries && 
      isRetryableError(error);
    
    if (canRetry) {
      this.state.nextDelayMs = error.retryAfter 
        ? error.retryAfter * 1000
        : calculateBackoffDelay(this.state.attempt - 1, this.config);
    } else {
      this.state.nextDelayMs = 0;
    }

    this.onStateChange?.(this.state);
    return canRetry;
  }

  async waitForRetry(): Promise<void> {
    if (this.state.nextDelayMs > 0) {
      await sleep(this.state.nextDelayMs);
    }
  }
}
