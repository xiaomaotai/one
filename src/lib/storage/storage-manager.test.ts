/**
 * Storage Manager Tests
 * 
 * Property Tests:
 * - Property 2: Message Order Preservation
 * 
 * Unit Tests:
 * - CRUD operations for configs and sessions
 * - Error conditions and recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { StorageManager } from './storage-manager';
import { deleteDB } from './db';
import type { ModelConfig, ChatSession, Message } from '../../types';
import { generateConfigId, generateSessionId, generateMessageId } from '../utils';

// ============================================
// Test Setup
// ============================================

let storage: StorageManager;

beforeEach(async () => {
  // Delete database before each test for isolation
  await deleteDB();
  storage = new StorageManager();
});

afterEach(async () => {
  await deleteDB();
});

// ============================================
// Arbitrary Generators
// ============================================

// (Generators defined inline in tests for simplicity)

// ============================================
// Property Tests
// ============================================

describe('Property 2: Message Order Preservation', () => {
  /**
   * Feature: multi-ai-chat-app, Property 2: Message Order Preservation
   * 
   * For any chat session, messages should be stored and retrieved in the exact
   * chronological order they were created, regardless of when they were persisted.
   * 
   * **Validates: Requirements 2.3, 3.1**
   */
  it('should preserve message order through storage round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 10 }),
        async (timestamps) => {
          const sessionId = generateSessionId();
          const configId = generateConfigId();
          
          // Create session
          const session: ChatSession = {
            id: sessionId,
            configId,
            title: 'Test Session',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: []
          };
          
          // Create messages with ordered timestamps
          const baseTime = new Date('2024-01-01T10:00:00Z').getTime();
          const messages: Message[] = timestamps.map((offset, index) => ({
            id: generateMessageId(),
            sessionId,
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${index}`,
            timestamp: new Date(baseTime + offset * 1000),
            isStreaming: false
          }));
          
          // Sort messages by timestamp (chronological order)
          messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          session.messages = messages;
          
          // Save session
          await storage.saveSession(session);
          
          // Load session
          const loaded = await storage.loadSession(sessionId);
          
          if (!loaded) {
            return false;
          }
          
          // Verify message count
          if (loaded.messages.length !== messages.length) {
            return false;
          }
          
          // Verify message order is preserved
          for (let i = 0; i < messages.length; i++) {
            if (loaded.messages[i].id !== messages[i].id) {
              return false;
            }
            if (loaded.messages[i].content !== messages[i].content) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Messages added incrementally should maintain order
   */
  it('should maintain order when messages are added incrementally', async () => {
    const sessionId = generateSessionId();
    const configId = generateConfigId();
    
    // Create empty session
    const session: ChatSession = {
      id: sessionId,
      configId,
      title: 'Test Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    await storage.saveSession(session);
    
    // Add messages one by one
    const messageIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const message: Message = {
        id: generateMessageId(),
        sessionId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(Date.now() + i * 1000),
        isStreaming: false
      };
      messageIds.push(message.id);
      await storage.saveMessage(message);
    }
    
    // Load and verify order
    const loaded = await storage.loadSession(sessionId);
    expect(loaded).toBeDefined();
    expect(loaded!.messages.length).toBe(5);
    
    for (let i = 0; i < 5; i++) {
      expect(loaded!.messages[i].id).toBe(messageIds[i]);
    }
  });
});

// ============================================
// Unit Tests - Configuration CRUD
// ============================================

describe('Configuration CRUD Operations', () => {
  it('should save and load a configuration', async () => {
    const config: ModelConfig = {
      id: generateConfigId(),
      name: 'Test Config',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key',
      isDefault: true,
      createdAt: new Date()
    };
    
    await storage.saveConfig(config);
    const loaded = await storage.getConfig(config.id);
    
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(config.id);
    expect(loaded!.name).toBe(config.name);
    expect(loaded!.provider).toBe(config.provider);
    expect(loaded!.apiKey).toBe(config.apiKey);
  });

  it('should load all configurations', async () => {
    const configs: ModelConfig[] = [
      {
        id: generateConfigId(),
        name: 'Config 1',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4',
        apiKey: 'sk-key-1',
        isDefault: true,
        createdAt: new Date()
      },
      {
        id: generateConfigId(),
        name: 'Config 2',
        provider: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        modelName: 'claude-3',
        apiKey: 'sk-key-2',
        isDefault: false,
        createdAt: new Date()
      }
    ];
    
    for (const config of configs) {
      await storage.saveConfig(config);
    }
    
    const loaded = await storage.loadConfigs();
    expect(loaded.length).toBe(2);
  });

  it('should delete a configuration', async () => {
    const config: ModelConfig = {
      id: generateConfigId(),
      name: 'To Delete',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      isDefault: false,
      createdAt: new Date()
    };
    
    await storage.saveConfig(config);
    await storage.deleteConfig(config.id);
    
    const loaded = await storage.getConfig(config.id);
    expect(loaded).toBeUndefined();
  });

  it('should update a configuration', async () => {
    const config: ModelConfig = {
      id: generateConfigId(),
      name: 'Original Name',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      isDefault: false,
      createdAt: new Date()
    };
    
    await storage.saveConfig(config);
    
    // Update
    config.name = 'Updated Name';
    config.modelName = 'gpt-4-turbo';
    await storage.saveConfig(config);
    
    const loaded = await storage.getConfig(config.id);
    expect(loaded!.name).toBe('Updated Name');
    expect(loaded!.modelName).toBe('gpt-4-turbo');
  });

  it('should set default configuration', async () => {
    const config1: ModelConfig = {
      id: generateConfigId(),
      name: 'Config 1',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-key-1',
      isDefault: true,
      createdAt: new Date()
    };
    
    const config2: ModelConfig = {
      id: generateConfigId(),
      name: 'Config 2',
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      modelName: 'claude-3',
      apiKey: 'sk-key-2',
      isDefault: false,
      createdAt: new Date()
    };
    
    await storage.saveConfig(config1);
    await storage.saveConfig(config2);
    
    // Set config2 as default
    await storage.setDefaultConfig(config2.id);
    
    const loaded1 = await storage.getConfig(config1.id);
    const loaded2 = await storage.getConfig(config2.id);
    
    expect(loaded1!.isDefault).toBe(false);
    expect(loaded2!.isDefault).toBe(true);
  });
});

// ============================================
// Unit Tests - Session CRUD
// ============================================

describe('Session CRUD Operations', () => {
  it('should save and load a session', async () => {
    const session: ChatSession = {
      id: generateSessionId(),
      configId: generateConfigId(),
      title: 'Test Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    await storage.saveSession(session);
    const loaded = await storage.loadSession(session.id);
    
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(session.id);
    expect(loaded!.title).toBe(session.title);
  });

  it('should load all sessions sorted by updatedAt', async () => {
    const now = Date.now();
    
    const sessions: ChatSession[] = [
      {
        id: generateSessionId(),
        configId: generateConfigId(),
        title: 'Old Session',
        createdAt: new Date(now - 10000),
        updatedAt: new Date(now - 10000),
        messages: []
      },
      {
        id: generateSessionId(),
        configId: generateConfigId(),
        title: 'New Session',
        createdAt: new Date(now),
        updatedAt: new Date(now),
        messages: []
      }
    ];
    
    for (const session of sessions) {
      await storage.saveSession(session);
    }
    
    const loaded = await storage.loadAllSessions();
    expect(loaded.length).toBe(2);
    expect(loaded[0].title).toBe('New Session'); // Most recent first
  });

  it('should delete a session', async () => {
    const session: ChatSession = {
      id: generateSessionId(),
      configId: generateConfigId(),
      title: 'To Delete',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    await storage.saveSession(session);
    await storage.deleteSession(session.id);
    
    const loaded = await storage.loadSession(session.id);
    expect(loaded).toBeUndefined();
  });

  it('should save session with messages', async () => {
    const sessionId = generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      configId: generateConfigId(),
      title: 'Session with Messages',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: generateMessageId(),
          sessionId,
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        },
        {
          id: generateMessageId(),
          sessionId,
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date()
        }
      ]
    };
    
    await storage.saveSession(session);
    const loaded = await storage.loadSession(session.id);
    
    expect(loaded!.messages.length).toBe(2);
    expect(loaded!.messages[0].content).toBe('Hello');
    expect(loaded!.messages[1].content).toBe('Hi there!');
  });
});

// ============================================
// Unit Tests - Message Operations
// ============================================

describe('Message Operations', () => {
  it('should add message to existing session', async () => {
    const sessionId = generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      configId: generateConfigId(),
      title: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    await storage.saveSession(session);
    
    const message: Message = {
      id: generateMessageId(),
      sessionId,
      role: 'user',
      content: 'New message',
      timestamp: new Date()
    };
    
    await storage.saveMessage(message);
    
    const loaded = await storage.loadSession(sessionId);
    expect(loaded!.messages.length).toBe(1);
    expect(loaded!.messages[0].content).toBe('New message');
  });

  it('should update existing message', async () => {
    const sessionId = generateSessionId();
    const messageId = generateMessageId();
    
    const session: ChatSession = {
      id: sessionId,
      configId: generateConfigId(),
      title: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [{
        id: messageId,
        sessionId,
        role: 'assistant',
        content: 'Original content',
        timestamp: new Date(),
        isStreaming: true
      }]
    };
    
    await storage.saveSession(session);
    
    // Update message
    const updatedMessage: Message = {
      id: messageId,
      sessionId,
      role: 'assistant',
      content: 'Updated content',
      timestamp: new Date(),
      isStreaming: false
    };
    
    await storage.saveMessage(updatedMessage);
    
    const loaded = await storage.loadSession(sessionId);
    expect(loaded!.messages.length).toBe(1);
    expect(loaded!.messages[0].content).toBe('Updated content');
    expect(loaded!.messages[0].isStreaming).toBe(false);
  });

  it('should load messages for a session', async () => {
    const sessionId = generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      configId: generateConfigId(),
      title: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        { id: generateMessageId(), sessionId, role: 'user', content: 'Msg 1', timestamp: new Date() },
        { id: generateMessageId(), sessionId, role: 'assistant', content: 'Msg 2', timestamp: new Date() }
      ]
    };
    
    await storage.saveSession(session);
    
    const messages = await storage.loadMessages(sessionId);
    expect(messages.length).toBe(2);
  });
});

// ============================================
// Unit Tests - Error Handling
// ============================================

describe('Error Handling', () => {
  it('should return undefined for non-existent config', async () => {
    const loaded = await storage.getConfig('non-existent-id');
    expect(loaded).toBeUndefined();
  });

  it('should return undefined for non-existent session', async () => {
    const loaded = await storage.loadSession('non-existent-id');
    expect(loaded).toBeUndefined();
  });

  it('should return empty array for non-existent session messages', async () => {
    const messages = await storage.loadMessages('non-existent-id');
    expect(messages).toEqual([]);
  });

  it('should throw error when saving message to non-existent session', async () => {
    const message: Message = {
      id: generateMessageId(),
      sessionId: 'non-existent-session',
      role: 'user',
      content: 'Test',
      timestamp: new Date()
    };
    
    await expect(storage.saveMessage(message)).rejects.toThrow('Session not found');
  });

  it('should handle deleting non-existent config gracefully', async () => {
    // Should not throw
    await storage.deleteConfig('non-existent-id');
  });

  it('should handle deleting non-existent session gracefully', async () => {
    // Should not throw
    await storage.deleteSession('non-existent-id');
  });
});

// ============================================
// Unit Tests - Utility Operations
// ============================================

describe('Utility Operations', () => {
  it('should clear all data', async () => {
    // Add some data
    await storage.saveConfig({
      id: generateConfigId(),
      name: 'Test',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      isDefault: true,
      createdAt: new Date()
    });
    
    await storage.saveSession({
      id: generateSessionId(),
      configId: generateConfigId(),
      title: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    });
    
    // Clear all
    await storage.clearAll();
    
    const configs = await storage.loadConfigs();
    const sessions = await storage.loadAllSessions();
    
    expect(configs.length).toBe(0);
    expect(sessions.length).toBe(0);
  });

  it('should get storage statistics', async () => {
    const sessionId = generateSessionId();
    
    await storage.saveConfig({
      id: generateConfigId(),
      name: 'Test',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      isDefault: true,
      createdAt: new Date()
    });
    
    await storage.saveSession({
      id: sessionId,
      configId: generateConfigId(),
      title: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        { id: generateMessageId(), sessionId, role: 'user', content: 'Msg 1', timestamp: new Date() },
        { id: generateMessageId(), sessionId, role: 'assistant', content: 'Msg 2', timestamp: new Date() }
      ]
    });
    
    const stats = await storage.getStats();
    
    expect(stats.configCount).toBe(1);
    expect(stats.sessionCount).toBe(1);
    expect(stats.messageCount).toBe(2);
  });
});
