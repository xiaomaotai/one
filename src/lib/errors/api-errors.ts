/**
 * API Error Handling
 * 
 * Handles network errors, rate limiting, and invalid responses.
 * 
 * Requirements: 2.5, 6.5
 */

import { ErrorCode, type AppError } from '../../types';

/** API error types */
export type ApiErrorType = 
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'invalid_response'
  | 'timeout'
  | 'server_error'
  | 'unknown';

/** API error with additional context */
export interface ApiError extends AppError {
  type: ApiErrorType;
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number; // seconds
}

/**
 * Create an API error from a fetch response
 */
export async function createApiErrorFromResponse(response: Response): Promise<ApiError> {
  const statusCode = response.status;
  let message = '';
  let type: ApiErrorType = 'unknown';
  let retryable = false;
  let retryAfter: number | undefined;

  // Try to parse error body
  try {
    const body = await response.json();
    message = body.error?.message || body.message || body.error || '未知错误';
  } catch {
    message = response.statusText || '请求失败';
  }

  // Determine error type based on status code
  if (statusCode === 401 || statusCode === 403) {
    type = 'auth';
    message = 'API密钥无效或已过期';
  } else if (statusCode === 429) {
    type = 'rate_limit';
    message = '请求过于频繁，请稍后重试';
    retryable = true;
    // Parse Retry-After header if present
    const retryHeader = response.headers.get('Retry-After');
    if (retryHeader) {
      retryAfter = parseInt(retryHeader, 10);
    } else {
      retryAfter = 60; // Default to 60 seconds
    }
  } else if (statusCode >= 500) {
    type = 'server_error';
    message = 'AI服务暂时不可用，请稍后重试';
    retryable = true;
  } else if (statusCode === 400) {
    type = 'invalid_response';
    message = `请求参数错误: ${message}`;
  }

  return {
    code: getErrorCode(type),
    message,
    type,
    statusCode,
    retryable,
    retryAfter
  };
}

/**
 * Create an API error from a network error
 */
export function createNetworkError(error: Error): ApiError {
  const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
  
  return {
    code: ErrorCode.NETWORK_ERROR,
    message: isTimeout ? '请求超时，请检查网络连接' : '网络连接失败，请检查网络设置',
    type: isTimeout ? 'timeout' : 'network',
    retryable: true,
    retryAfter: 5
  };
}

/**
 * Create an API error from an unknown error
 */
export function createUnknownApiError(error: unknown): ApiError {
  let message: string;
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = '未知错误';
  }
  
  return {
    code: ErrorCode.API_ERROR,
    message: `API调用失败: ${message}`,
    type: 'unknown',
    retryable: false
  };
}

/**
 * Get error code from error type
 */
function getErrorCode(type: ApiErrorType): ErrorCode {
  switch (type) {
    case 'network':
    case 'timeout':
      return ErrorCode.NETWORK_ERROR;
    case 'auth':
      return ErrorCode.AUTH_ERROR;
    case 'rate_limit':
      return ErrorCode.RATE_LIMIT;
    case 'invalid_response':
      return ErrorCode.INVALID_RESPONSE;
    default:
      return ErrorCode.API_ERROR;
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: ApiError): boolean {
  return error.retryable;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'network':
      return '网络连接失败，请检查您的网络设置后重试';
    case 'timeout':
      return '请求超时，请稍后重试';
    case 'auth':
      return 'API密钥无效或已过期，请检查配置';
    case 'rate_limit':
      return error.retryAfter 
        ? `请求过于频繁，请在 ${error.retryAfter} 秒后重试`
        : '请求过于频繁，请稍后重试';
    case 'server_error':
      return 'AI服务暂时不可用，请稍后重试';
    case 'invalid_response':
      return `请求参数错误: ${error.message}`;
    default:
      return error.message || '发生未知错误，请重试';
  }
}

/**
 * Parse error from any source
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof Response) {
    // This shouldn't happen in sync context, but handle it
    return {
      code: ErrorCode.API_ERROR,
      message: '请求失败',
      type: 'unknown',
      statusCode: error.status,
      retryable: false
    };
  }
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createNetworkError(error);
  }
  
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        code: ErrorCode.API_ERROR,
        message: '请求已取消',
        type: 'timeout',
        retryable: false
      };
    }
    return createUnknownApiError(error);
  }
  
  return createUnknownApiError(error);
}
