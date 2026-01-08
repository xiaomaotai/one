/**
 * API Adapter Tests
 * 
 * Property Tests:
 * - Property 5: Configuration Validation Consistency
 * 
 * Unit Tests:
 * - Request building for each provider
 * - Error handling and edge cases
 * - Adapter factory
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { OpenAIAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { GoogleAdapter } from './google-adapter';
import { createAdapter, getDefaultApiUrl, getSuggestedModels } from './adapter-factory';
import type { ModelConfig, Message, AIProvider } from '../../types';

// ============================================
// Mock fetch for testing
// ============================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// ============================================
// Arbitrary Generators
// ============================================

const arbProvider = fc.constantFrom<AIProvider>('openai', 'anthropic', 'google', 'openai-compatible');

const arbModelConfig = (provider: AIProvider): fc.Arbitrary<ModelConfig> => fc.record({
  id: fc.uuid().map(id => `config-${id}`),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  provider: fc.constant(provider),
  apiUrl: fc.constant(getDefaultApiUrl(provider) || 'https://api.example.com'),
  modelName: fc.string({ minLength: 1, maxLength: 30 }),
  apiKey: fc.string({ minLength: 10, maxLength: 100 }),
  isDefault: fc.boolean(),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .filter(d => !isNaN(d.getTime()))
});

// ============================================
// Property Tests
// ============================================

describe('Property 5: Configuration Validation Consistency', () => {
  /**
   * Feature: multi-ai-chat-app, Property 5: Configuration Validation Consistency
   * 
   * For any model configuration, if it passes validation, it should be usable
   * for API requests without authentication errors.
   * 
   * Note: This test validates that the adapter factory correctly creates adapters
   * for all valid configurations. Actual API validation requires real credentials.
   * 
   * **Validates: Requirements 1.4, 6.1, 6.2, 6.3, 6.4**
   */
  it('should create valid adapter for any valid configuration', () => {
    fc.assert(
      fc.property(arbProvider, (provider) => {
        return fc.assert(
          fc.property(arbModelConfig(provider), (config) => {
            // Should not throw when creating adapter
            const adapter = createAdapter(config);
            
            // Adapter should have required methods
            expect(typeof adapter.sendMessage).toBe('function');
            expect(typeof adapter.validateCredentials).toBe('function');
            
            return true;
          }),
          { numRuns: 20 }
        );
      }),
      { numRuns: 4 } // One for each provider
    );
  });

  /**
   * Adapter factory should handle all provider types
   */
  it('should handle all provider types without error', () => {
    const providers: AIProvider[] = ['openai', 'anthropic', 'google', 'openai-compatible'];
    
    for (const provider of providers) {
      const config: ModelConfig = {
        id: 'test-config',
        name: 'Test',
        provider,
        apiUrl: getDefaultApiUrl(provider) || 'https://api.example.com',
        modelName: 'test-model',
        apiKey: 'test-api-key',
        isDefault: false,
        createdAt: new Date()
      };
      
      expect(() => createAdapter(config)).not.toThrow();
    }
  });
});

// ============================================
// Unit Tests - OpenAI Adapter
// ============================================

describe('OpenAI Adapter', () => {
  it('should create adapter with correct properties', () => {
    const adapter = new OpenAIAdapter('sk-test', 'https://api.openai.com/v1', 'gpt-4');
    
    expect(adapter.apiKey).toBe('sk-test');
    expect(adapter.apiUrl).toBe('https://api.openai.com/v1');
    expect(adapter.modelName).toBe('gpt-4');
  });

  it('should validate credentials successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    const adapter = new OpenAIAdapter('sk-test', 'https://api.openai.com/v1', 'gpt-4');
    const isValid = await adapter.validateCredentials();
    
    expect(isValid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Authorization': 'Bearer sk-test' }
      })
    );
  });

  it('should return false for invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    const adapter = new OpenAIAdapter('invalid-key', 'https://api.openai.com/v1', 'gpt-4');
    const isValid = await adapter.validateCredentials();
    
    expect(isValid).toBe(false);
  });

  it('should handle network errors during validation', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const adapter = new OpenAIAdapter('sk-test', 'https://api.openai.com/v1', 'gpt-4');
    const isValid = await adapter.validateCredentials();
    
    expect(isValid).toBe(false);
  });

  it('should throw error for failed API request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });

    const adapter = new OpenAIAdapter('sk-test', 'https://api.openai.com/v1', 'gpt-4');
    const history: Message[] = [];
    
    await expect(async () => {
      const generator = adapter.sendMessage('Hello', history);
      await generator.next();
    }).rejects.toThrow('OpenAI API error');
  });
});

// ============================================
// Unit Tests - Anthropic Adapter
// ============================================

describe('Anthropic Adapter', () => {
  it('should create adapter with correct properties', () => {
    const adapter = new AnthropicAdapter('sk-ant-test', 'claude-3-opus');
    
    expect(adapter.apiKey).toBe('sk-ant-test');
    expect(adapter.modelName).toBe('claude-3-opus');
    expect(adapter.apiUrl).toBe('https://api.anthropic.com');
  });

  it('should use custom API URL when provided', () => {
    const adapter = new AnthropicAdapter('sk-ant-test', 'claude-3-opus', 'https://custom.api.com');
    
    expect(adapter.apiUrl).toBe('https://custom.api.com');
  });

  it('should validate credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    });

    const adapter = new AnthropicAdapter('sk-ant-test', 'claude-3-opus');
    const isValid = await adapter.validateCredentials();
    
    expect(isValid).toBe(true);
  });
});

// ============================================
// Unit Tests - Google Adapter
// ============================================

describe('Google Adapter', () => {
  it('should create adapter with correct properties', () => {
    const adapter = new GoogleAdapter('google-api-key', 'gemini-pro');
    
    expect(adapter.apiKey).toBe('google-api-key');
    expect(adapter.modelName).toBe('gemini-pro');
    expect(adapter.apiUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
  });

  it('should validate credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] })
    });

    const adapter = new GoogleAdapter('google-api-key', 'gemini-pro');
    const isValid = await adapter.validateCredentials();
    
    expect(isValid).toBe(true);
  });
});

// ============================================
// Unit Tests - Adapter Factory
// ============================================

describe('Adapter Factory', () => {
  it('should create OpenAI adapter for openai provider', () => {
    const config: ModelConfig = {
      id: 'test',
      name: 'Test',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      isDefault: false,
      createdAt: new Date()
    };
    
    const adapter = createAdapter(config);
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it('should create OpenAI adapter for openai-compatible provider', () => {
    const config: ModelConfig = {
      id: 'test',
      name: 'Test',
      provider: 'openai-compatible',
      apiUrl: 'https://custom.api.com/v1',
      modelName: 'custom-model',
      apiKey: 'custom-key',
      isDefault: false,
      createdAt: new Date()
    };
    
    const adapter = createAdapter(config);
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
    expect((adapter as OpenAIAdapter).apiUrl).toBe('https://custom.api.com/v1');
  });

  it('should create Anthropic adapter for anthropic provider', () => {
    const config: ModelConfig = {
      id: 'test',
      name: 'Test',
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      modelName: 'claude-3-opus',
      apiKey: 'sk-ant-test',
      isDefault: false,
      createdAt: new Date()
    };
    
    const adapter = createAdapter(config);
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it('should create Google adapter for google provider', () => {
    const config: ModelConfig = {
      id: 'test',
      name: 'Test',
      provider: 'google',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      modelName: 'gemini-pro',
      apiKey: 'google-key',
      isDefault: false,
      createdAt: new Date()
    };
    
    const adapter = createAdapter(config);
    expect(adapter).toBeInstanceOf(GoogleAdapter);
  });

  it('should throw error for unknown provider', () => {
    const config = {
      id: 'test',
      name: 'Test',
      provider: 'unknown' as AIProvider,
      apiUrl: 'https://api.example.com',
      modelName: 'model',
      apiKey: 'key',
      isDefault: false,
      createdAt: new Date()
    };
    
    expect(() => createAdapter(config)).toThrow('Unknown provider');
  });

  it('should return correct default API URLs', () => {
    expect(getDefaultApiUrl('openai')).toBe('https://api.openai.com/v1');
    expect(getDefaultApiUrl('anthropic')).toBe('https://api.anthropic.com');
    expect(getDefaultApiUrl('google')).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(getDefaultApiUrl('openai-compatible')).toBe('');
  });

  it('should return suggested models for each provider', () => {
    expect(getSuggestedModels('openai').length).toBeGreaterThan(0);
    expect(getSuggestedModels('anthropic').length).toBeGreaterThan(0);
    expect(getSuggestedModels('google').length).toBeGreaterThan(0);
    expect(getSuggestedModels('openai-compatible')).toEqual([]);
  });
});

// ============================================
// Unit Tests - Message Formatting
// ============================================

describe('Message Formatting', () => {
  it('should format messages correctly for OpenAI', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn()
        })
      }
    });

    const adapter = new OpenAIAdapter('sk-test', 'https://api.openai.com/v1', 'gpt-4');
    const history: Message[] = [
      { id: '1', sessionId: 's1', role: 'user', content: 'Hello', timestamp: new Date() },
      { id: '2', sessionId: 's1', role: 'assistant', content: 'Hi there', timestamp: new Date() }
    ];
    
    const generator = adapter.sendMessage('How are you?', history);
    await generator.next();
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"messages"')
      })
    );
    
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages).toHaveLength(3);
    expect(callBody.messages[0].role).toBe('user');
    expect(callBody.messages[1].role).toBe('assistant');
    expect(callBody.messages[2].role).toBe('user');
  });
});
