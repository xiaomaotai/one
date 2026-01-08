/**
 * Adapter Factory
 * 
 * Creates appropriate API adapter based on provider type.
 * Supports OpenAI, Anthropic, Google Gemini, and OpenAI-compatible APIs.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 1.5
 */

import type { AIAdapter, ModelConfig } from '../../types';
import { OpenAIAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { GoogleAdapter } from './google-adapter';

/**
 * Create an API adapter based on the model configuration
 */
export function createAdapter(config: ModelConfig): AIAdapter {
  switch (config.provider) {
    case 'openai':
      return new OpenAIAdapter(
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1',
        config.modelName
      );
    
    case 'openai-compatible':
      // OpenAI-compatible APIs use the same adapter with custom URL
      return new OpenAIAdapter(
        config.apiKey,
        config.apiUrl,
        config.modelName
      );
    
    case 'anthropic':
      return new AnthropicAdapter(
        config.apiKey,
        config.modelName,
        config.apiUrl || 'https://api.anthropic.com'
      );
    
    case 'google':
      return new GoogleAdapter(
        config.apiKey,
        config.modelName,
        config.apiUrl || 'https://generativelanguage.googleapis.com/v1beta'
      );
    
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Get default API URL for a provider
 */
export function getDefaultApiUrl(provider: ModelConfig['provider']): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'openai-compatible':
      return '';
    default:
      return '';
  }
}

/**
 * Get suggested models for a provider
 */
export function getSuggestedModels(provider: ModelConfig['provider']): string[] {
  switch (provider) {
    case 'openai':
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    case 'anthropic':
      return ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
    case 'google':
      return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    case 'openai-compatible':
      return [];
    default:
      return [];
  }
}
