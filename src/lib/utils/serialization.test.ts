/**
 * Property Test: Configuration Persistence Round Trip
 * 
 * **Property 1: Configuration Persistence Round Trip**
 * *For any* valid model configuration, saving it to storage and then loading it 
 * should produce an equivalent configuration object.
 * 
 * **Validates: Requirements 1.1, 7.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ModelConfig, Message, ChatSession, AIProvider } from '../../types';
import {
  serializeConfig,
  deserializeConfig,
  serializeMessage,
  deserializeMessage,
  serializeSession,
  deserializeSession,
  configsEqual,
  messagesEqual,
  sessionsEqual
} from './serialization';

// ============================================
// Arbitrary Generators
// ============================================

/** Generate a valid AIProvider */
const arbProvider = fc.constantFrom<AIProvider>('openai', 'anthropic', 'google', 'openai-compatible');

/** Generate a valid date (ensuring no NaN dates) */
const arbValidDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  .filter(d => !isNaN(d.getTime()));

/** Generate a valid ModelConfig */
const arbModelConfig: fc.Arbitrary<ModelConfig> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  provider: arbProvider,
  apiUrl: fc.webUrl(),
  modelName: fc.string({ minLength: 1, maxLength: 50 }),
  apiKey: fc.string({ minLength: 1, maxLength: 200 }),
  isDefault: fc.boolean(),
  createdAt: arbValidDate
});

/** Generate a valid Message */
const arbMessage: fc.Arbitrary<Message> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  sessionId: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.constantFrom<'user' | 'assistant'>('user', 'assistant'),
  content: fc.string({ minLength: 0, maxLength: 10000 }),
  timestamp: arbValidDate,
  isStreaming: fc.option(fc.boolean(), { nil: undefined })
});

/** Generate a valid ChatSession */
const arbChatSession: fc.Arbitrary<ChatSession> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  configId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  createdAt: arbValidDate,
  updatedAt: arbValidDate,
  messages: fc.array(arbMessage, { minLength: 0, maxLength: 20 })
});

// ============================================
// Property Tests
// ============================================

describe('Property 1: Configuration Persistence Round Trip', () => {
  /**
   * Feature: multi-ai-chat-app, Property 1: Configuration Persistence Round Trip
   * 
   * For any valid model configuration, serializing then deserializing 
   * should produce an equivalent configuration object.
   */
  it('should preserve ModelConfig through serialization round-trip', () => {
    fc.assert(
      fc.property(arbModelConfig, (config) => {
        const serialized = serializeConfig(config);
        const deserialized = deserializeConfig(serialized);
        
        return configsEqual(config, deserialized);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * For any valid message, serializing then deserializing 
   * should produce an equivalent message object.
   */
  it('should preserve Message through serialization round-trip', () => {
    fc.assert(
      fc.property(arbMessage, (message) => {
        const serialized = serializeMessage(message);
        const deserialized = deserializeMessage(serialized);
        
        return messagesEqual(message, deserialized);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * For any valid chat session, serializing then deserializing 
   * should produce an equivalent session object.
   */
  it('should preserve ChatSession through serialization round-trip', () => {
    fc.assert(
      fc.property(arbChatSession, (session) => {
        const serialized = serializeSession(session);
        const deserialized = deserializeSession(serialized);
        
        return sessionsEqual(session, deserialized);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Serialized config should have createdAt as ISO string
   */
  it('should serialize dates as ISO strings', () => {
    fc.assert(
      fc.property(arbModelConfig, (config) => {
        const serialized = serializeConfig(config);
        
        // createdAt should be a string
        expect(typeof serialized.createdAt).toBe('string');
        
        // Should be valid ISO date string
        const parsed = new Date(serialized.createdAt);
        expect(parsed.getTime()).toBe(config.createdAt.getTime());
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * All message timestamps in a session should be preserved
   */
  it('should preserve all message timestamps in session round-trip', () => {
    fc.assert(
      fc.property(arbChatSession, (session) => {
        const serialized = serializeSession(session);
        const deserialized = deserializeSession(serialized);
        
        // Check each message timestamp
        for (let i = 0; i < session.messages.length; i++) {
          const original = session.messages[i];
          const restored = deserialized.messages[i];
          
          if (original.timestamp.getTime() !== restored.timestamp.getTime()) {
            return false;
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Unit Tests (Edge Cases)
// ============================================

describe('Serialization Edge Cases', () => {
  it('should handle empty message content', () => {
    const message: Message = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: '',
      timestamp: new Date('2024-01-01T10:00:00Z')
    };
    
    const serialized = serializeMessage(message);
    const deserialized = deserializeMessage(serialized);
    
    expect(messagesEqual(message, deserialized)).toBe(true);
  });

  it('should handle session with no messages', () => {
    const session: ChatSession = {
      id: 'session-1',
      configId: 'config-1',
      title: 'Empty Session',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      messages: []
    };
    
    const serialized = serializeSession(session);
    const deserialized = deserializeSession(serialized);
    
    expect(sessionsEqual(session, deserialized)).toBe(true);
  });

  it('should handle special characters in content', () => {
    const message: Message = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '你好！\n\t"引号" \'单引号\' <html> & 特殊字符 🎉',
      timestamp: new Date('2024-01-01T10:00:00Z')
    };
    
    const serialized = serializeMessage(message);
    const deserialized = deserializeMessage(serialized);
    
    expect(messagesEqual(message, deserialized)).toBe(true);
  });

  it('should handle config with long API key', () => {
    const config: ModelConfig = {
      id: 'config-1',
      name: 'Test Config',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-' + 'a'.repeat(200),
      isDefault: true,
      createdAt: new Date('2024-01-01T10:00:00Z')
    };
    
    const serialized = serializeConfig(config);
    const deserialized = deserializeConfig(serialized);
    
    expect(configsEqual(config, deserialized)).toBe(true);
  });
});
