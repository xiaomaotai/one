/**
 * Native HTTP Utility
 * 
 * When CapacitorHttp is enabled in capacitor.config.ts, 
 * Capacitor automatically patches the global fetch to use native HTTP on mobile platforms.
 * This bypasses CORS restrictions.
 * 
 * This module provides wrapper functions that work on both web and native platforms.
 */

import { Capacitor } from '@capacitor/core';

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

export interface NativeHttpResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

/**
 * Make a POST request that works on both native and web platforms
 * When CapacitorHttp is enabled, fetch is automatically patched on native platforms
 */
export async function nativePost(
  url: string,
  data: unknown,
  headers: Record<string, string>
): Promise<NativeHttpResponse> {
  console.log(`[NativeHTTP] POST ${url} (native: ${isNative})`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    });

    console.log('[NativeHTTP] Response status:', response.status);
    
    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    return {
      status: response.status,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error('[NativeHTTP] POST error:', error);
    throw error;
  }
}

/**
 * Make a GET request that works on both native and web platforms
 * When CapacitorHttp is enabled, fetch is automatically patched on native platforms
 */
export async function nativeGet(
  url: string,
  headers: Record<string, string>
): Promise<NativeHttpResponse> {
  console.log(`[NativeHTTP] GET ${url} (native: ${isNative})`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    console.log('[NativeHTTP] Response status:', response.status);
    
    let responseData: unknown;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    return {
      status: response.status,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error('[NativeHTTP] GET error:', error);
    throw error;
  }
}