/**
 * Storage Error Handling
 * 
 * Provides error types and handling utilities for storage operations.
 * Requirements: 7.5
 */

import { ErrorCode, createAppError, type AppError } from '../../types';

/**
 * Storage-specific error class
 */
export class StorageError extends Error {
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.details = details;
  }

  toAppError(): AppError {
    return createAppError(this.code, this.message, this.details);
  }
}

/**
 * Check if error is a quota exceeded error
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    // Different browsers use different error names
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 // Legacy quota exceeded code
    );
  }
  return false;
}

/**
 * Check if error is a data corruption error
 */
export function isDataCorruptionError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === 'DataError' ||
      error.name === 'InvalidStateError'
    );
  }
  if (error instanceof SyntaxError) {
    return true; // JSON parse errors
  }
  return false;
}

/**
 * Wrap storage operation with error handling
 */
export async function withStorageErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new StorageError(
        ErrorCode.STORAGE_QUOTA_EXCEEDED,
        `存储空间不足: ${context}`,
        error
      );
    }
    
    if (isDataCorruptionError(error)) {
      throw new StorageError(
        ErrorCode.DATA_CORRUPTED,
        `数据损坏: ${context}`,
        error
      );
    }
    
    throw new StorageError(
      ErrorCode.STORAGE_ERROR,
      `存储操作失败: ${context}`,
      error
    );
  }
}

/**
 * Attempt to recover from storage errors
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  recoveredData?: unknown;
}

/**
 * Try to recover corrupted data by clearing and reinitializing
 */
export async function attemptRecovery(
  clearFn: () => Promise<void>
): Promise<RecoveryResult> {
  try {
    await clearFn();
    return {
      success: true,
      message: '数据已重置，存储已恢复正常'
    };
  } catch (error) {
    return {
      success: false,
      message: '无法恢复存储，请尝试清除浏览器数据'
    };
  }
}

/**
 * Check storage availability and health
 */
export async function checkStorageHealth(): Promise<{
  available: boolean;
  quotaUsed?: number;
  quotaTotal?: number;
  error?: string;
}> {
  try {
    // Check if IndexedDB is available
    if (!('indexedDB' in window)) {
      return {
        available: false,
        error: '浏览器不支持 IndexedDB'
      };
    }

    // Try to estimate storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        available: true,
        quotaUsed: estimate.usage,
        quotaTotal: estimate.quota
      };
    }

    return { available: true };
  } catch (error) {
    return {
      available: false,
      error: '无法检查存储状态'
    };
  }
}

/**
 * Format storage size for display
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
