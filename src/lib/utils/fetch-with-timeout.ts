/**
 * Fetch with Timeout Utility
 * 
 * Provides a fetch wrapper with connection timeout support.
 * Helps fail fast on configuration errors (wrong API key, URL, etc.)
 */

/**
 * Fetch with connection timeout
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Connection timeout in milliseconds (default: 15000)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('连接超时，请检查网络或 API 地址是否正确');
      }
      // Enhance network error messages
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络或 API 地址');
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
