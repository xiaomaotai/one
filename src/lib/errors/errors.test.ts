/**
 * Error Handling Tests
 * 
 * Unit Tests:
 * - API error parsing
 * - Retry logic
 * - Error message generation
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createNetworkError,
  createUnknownApiError,
  parseApiError,
  getErrorMessage,
  isRetryableError,
  type ApiError
} from './api-errors';
import {
  calculateBackoffDelay,
  withRetry,
  RetryManager,
  DEFAULT_RETRY_CONFIG
} from './retry';
import { ErrorCode } from '../../types';

// ============================================
// API Error Tests
// ============================================

describe('API Error Handling', () => {
  describe('createNetworkError', () => {
    it('should create network error', () => {
      const error = new Error('Failed to fetch');
      const apiError = createNetworkError(error);
      
      expect(apiError.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(apiError.type).toBe('network');
      expect(apiError.retryable).toBe(true);
    });

    it('should detect timeout errors', () => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      const apiError = createNetworkError(error);
      
      expect(apiError.type).toBe('timeout');
      expect(apiError.retryable).toBe(true);
    });
  });

  describe('createUnknownApiError', () => {
    it('should create error from Error object', () => {
      const error = new Error('Something went wrong');
      const apiError = createUnknownApiError(error);
      
      expect(apiError.code).toBe(ErrorCode.API_ERROR);
      expect(apiError.message).toContain('Something went wrong');
      expect(apiError.retryable).toBe(false);
    });

    it('should handle non-Error objects', () => {
      const apiError = createUnknownApiError('string error');
      
      expect(apiError.code).toBe(ErrorCode.API_ERROR);
      expect(apiError.message).toContain('string error');
    });
  });

  describe('parseApiError', () => {
    it('should parse TypeError as network error', () => {
      const error = new TypeError('Failed to fetch');
      const apiError = parseApiError(error);
      
      expect(apiError.type).toBe('network');
    });

    it('should parse AbortError', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      const apiError = parseApiError(error);
      
      expect(apiError.type).toBe('timeout');
    });

    it('should handle unknown errors', () => {
      const apiError = parseApiError({ weird: 'object' });
      
      expect(apiError.code).toBe(ErrorCode.API_ERROR);
    });
  });

  describe('getErrorMessage', () => {
    it('should return user-friendly message for network error', () => {
      const error: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network failed',
        type: 'network',
        retryable: true
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('网络');
    });

    it('should return user-friendly message for auth error', () => {
      const error: ApiError = {
        code: ErrorCode.AUTH_ERROR,
        message: 'Unauthorized',
        type: 'auth',
        retryable: false
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('API密钥');
    });

    it('should include retry time for rate limit', () => {
      const error: ApiError = {
        code: ErrorCode.RATE_LIMIT,
        message: 'Too many requests',
        type: 'rate_limit',
        retryable: true,
        retryAfter: 30
      };
      
      const message = getErrorMessage(error);
      expect(message).toContain('30');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      const error: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error: ApiError = {
        code: ErrorCode.AUTH_ERROR,
        message: 'Auth error',
        type: 'auth',
        retryable: false
      };
      
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

// ============================================
// Retry Logic Tests
// ============================================

describe('Retry Logic', () => {
  describe('calculateBackoffDelay', () => {
    it('should calculate exponential delay', () => {
      const delay0 = calculateBackoffDelay(0);
      const delay1 = calculateBackoffDelay(1);
      const delay2 = calculateBackoffDelay(2);
      
      // With jitter, delays should roughly follow exponential pattern
      expect(delay0).toBeGreaterThan(0);
      expect(delay1).toBeGreaterThan(delay0 * 1.5);
      expect(delay2).toBeGreaterThan(delay1 * 1.5);
    });

    it('should respect max delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 5000 };
      const delay = calculateBackoffDelay(10, config);
      
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const retryableError: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      const fn = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, { 
        maxRetries: 2, 
        initialDelayMs: 10 
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const nonRetryableError: ApiError = {
        code: ErrorCode.AUTH_ERROR,
        message: 'Auth error',
        type: 'auth',
        retryable: false
      };
      
      const fn = vi.fn().mockRejectedValue(nonRetryableError);
      
      await expect(withRetry(fn, { maxRetries: 2 }))
        .rejects.toThrow();
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const retryableError: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      const fn = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      
      await withRetry(fn, { maxRetries: 2, initialDelayMs: 10 }, onRetry);
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Object), expect.any(Number));
    });

    it('should throw after max retries', async () => {
      const retryableError: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      const fn = vi.fn().mockRejectedValue(retryableError);
      
      await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10 }))
        .rejects.toThrow();
      
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('RetryManager', () => {
    it('should track retry state', () => {
      const manager = new RetryManager();
      
      expect(manager.getState().attempt).toBe(0);
    });

    it('should record failures', () => {
      const manager = new RetryManager();
      const error: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      const canRetry = manager.recordFailure(error);
      
      expect(canRetry).toBe(true);
      expect(manager.getState().attempt).toBe(1);
      expect(manager.getState().lastError).toBe(error);
    });

    it('should return false when max retries exceeded', () => {
      const manager = new RetryManager({ maxRetries: 1 });
      const error: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      manager.recordFailure(error);
      const canRetry = manager.recordFailure(error);
      
      expect(canRetry).toBe(false);
    });

    it('should reset state', () => {
      const manager = new RetryManager();
      const error: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      manager.recordFailure(error);
      manager.reset();
      
      expect(manager.getState().attempt).toBe(0);
      expect(manager.getState().lastError).toBeUndefined();
    });

    it('should call onStateChange callback', () => {
      const manager = new RetryManager();
      const callback = vi.fn();
      manager.setOnStateChange(callback);
      
      const error: ApiError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        type: 'network',
        retryable: true
      };
      
      manager.recordFailure(error);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should use retryAfter from error', () => {
      const manager = new RetryManager();
      const error: ApiError = {
        code: ErrorCode.RATE_LIMIT,
        message: 'Rate limited',
        type: 'rate_limit',
        retryable: true,
        retryAfter: 60
      };
      
      manager.recordFailure(error);
      
      expect(manager.getState().nextDelayMs).toBe(60000);
    });
  });
});
