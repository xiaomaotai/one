/**
 * Integration Tests
 * 
 * End-to-end tests for chat flow, configuration switching,
 * history loading, and session management.
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.3, 3.4, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chatManager } from './chat';
import { configManager } from './config';
import { storageManager } from './storage';
import type { ModelConfig, ChatSession, Message } from '../types';

// Mock the adapters to avoid real API calls
vi.mock('./adapters', () => ({
  createAdapter: vi.fn(() => ({
    sendMessage: async function* () {
      yield '你好';
      yield '！';
      yield '我是AI助手。';
    },
    validateCredentials: vi.fn().mockResolvedValue(true),
  })),
  getDefaultApiUrl: vi.fn((provider: string) => {
    const urls: Record<string, string> = {
      'openai': 'https://api.openai.com/v1',
      'anthropic': 'https://api.anthropic.com',
      'google': 'https://generativelanguage.googleapis.com/v1beta',
      'openai-compatible': '',
    };
    return urls[provider] || '';
  }),
}));

describe('Integration Tests', () => {
  beforeEach(async () => {
    // Clear all data before each test
    const sessions = await storageManager.loadAllSessions();
    for (const session of sessions) {
      await storageManager.deleteSession(session.id);
    }
    
    const configs = await storageManager.loadConfigs();
    for (const config of configs) {
      await storageManager.deleteConfig(config.id);
    }
  });

  describe('15.1 End-to-end chat flow', () => {
    it('should complete full chat flow: send message → receive response → save to history', async () => {
      // Create a config
      const config = await configManager.createConfig({
        name: '测试配置',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
        isDefault: true,
      });

      // Create a session
      const session = await chatManager.createSession(config.id);
      expect(session).toBeDefined();
      expect(session.configId).toBe(config.id);

      // Set up callbacks to track streaming
      let streamStarted = false;
      let streamEnded = false;
      let finalContent = '';

      chatManager.setCallbacks({
        onStreamStart: () => { streamStarted = true; },
        onStreamEnd: (_sessionId, _messageId, content) => {
          streamEnded = true;
          finalContent = content;
        },
      });

      // Send a message
      const userMessage = await chatManager.sendMessage(session.id, '你好');
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('你好');

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify streaming occurred
      expect(streamStarted).toBe(true);
      expect(streamEnded).toBe(true);
      expect(finalContent).toBe('你好！我是AI助手。');

      // Verify messages are saved
      const loadedSession = await chatManager.getSession(session.id);
      expect(loadedSession).toBeDefined();
      expect(loadedSession!.messages.length).toBe(2);
      expect(loadedSession!.messages[0].role).toBe('user');
      expect(loadedSession!.messages[1].role).toBe('assistant');
    });
  });

  describe('15.2 Configuration switching during chat', () => {
    it('should switch models mid-conversation and use new model for next message', async () => {
      // Create two configs
      const config1 = await configManager.createConfig({
        name: 'GPT-4',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key-1',
        isDefault: true,
      });

      const config2 = await configManager.createConfig({
        name: 'Claude',
        provider: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        modelName: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key-2',
      });

      // Create session with first config
      const session = await chatManager.createSession(config1.id);
      expect(session.configId).toBe(config1.id);

      // Switch to second config
      await chatManager.switchSessionConfig(session.id, config2.id);

      // Verify config was switched
      const updatedSession = await chatManager.getSession(session.id);
      expect(updatedSession!.configId).toBe(config2.id);
    });
  });

  describe('15.3 History loading and restoration', () => {
    it('should load historical session with all messages present', async () => {
      // Create config
      const config = await configManager.createConfig({
        name: '测试配置',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
        isDefault: true,
      });

      // Create session and add messages
      const session = await chatManager.createSession(config.id);
      await chatManager.sendMessage(session.id, '第一条消息');
      await new Promise(resolve => setTimeout(resolve, 50));
      await chatManager.sendMessage(session.id, '第二条消息');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Load session from storage
      const loadedSession = await chatManager.getSession(session.id);
      expect(loadedSession).toBeDefined();
      expect(loadedSession!.messages.length).toBe(4); // 2 user + 2 assistant

      // Verify message order
      expect(loadedSession!.messages[0].content).toBe('第一条消息');
      expect(loadedSession!.messages[0].role).toBe('user');
      expect(loadedSession!.messages[2].content).toBe('第二条消息');
      expect(loadedSession!.messages[2].role).toBe('user');
    });

    it('should get session previews for history list', async () => {
      // Create config
      const config = await configManager.createConfig({
        name: '测试配置',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
        isDefault: true,
      });

      // Create multiple sessions
      const session1 = await chatManager.createSession(config.id, '对话1');
      const session2 = await chatManager.createSession(config.id, '对话2');

      // Get previews
      const previews = await chatManager.getSessionPreviews();
      expect(previews.length).toBe(2);
      expect(previews.some(p => p.title === '对话1')).toBe(true);
      expect(previews.some(p => p.title === '对话2')).toBe(true);
    });
  });

  describe('15.4 Multiple concurrent sessions', () => {
    it('should maintain state isolation between sessions', async () => {
      // Create config
      const config = await configManager.createConfig({
        name: '测试配置',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
        isDefault: true,
      });

      // Create two sessions
      const session1 = await chatManager.createSession(config.id, '会话1');
      const session2 = await chatManager.createSession(config.id, '会话2');

      // Send messages to each session
      await chatManager.sendMessage(session1.id, '会话1的消息');
      await new Promise(resolve => setTimeout(resolve, 50));
      await chatManager.sendMessage(session2.id, '会话2的消息');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify isolation
      const loaded1 = await chatManager.getSession(session1.id);
      const loaded2 = await chatManager.getSession(session2.id);

      expect(loaded1!.messages.some(m => m.content === '会话1的消息')).toBe(true);
      expect(loaded1!.messages.some(m => m.content === '会话2的消息')).toBe(false);

      expect(loaded2!.messages.some(m => m.content === '会话2的消息')).toBe(true);
      expect(loaded2!.messages.some(m => m.content === '会话1的消息')).toBe(false);
    });

    it('should allow switching between sessions', async () => {
      // Create config
      const config = await configManager.createConfig({
        name: '测试配置',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
        isDefault: true,
      });

      // Create sessions
      const session1 = await chatManager.createSession(config.id);
      const session2 = await chatManager.createSession(config.id);

      // Get all sessions
      const allSessions = await chatManager.getAllSessions();
      expect(allSessions.length).toBe(2);

      // Verify both sessions are accessible
      const s1 = await chatManager.getSession(session1.id);
      const s2 = await chatManager.getSession(session2.id);
      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
    });
  });

  describe('15.5 Storage recovery', () => {
    it('should handle session deletion gracefully', async () => {
      // Create config
      const config = await configManager.createConfig({
        name: '测试配置',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
        isDefault: true,
      });

      // Create and delete session
      const session = await chatManager.createSession(config.id);
      await chatManager.deleteSession(session.id);

      // Verify session is deleted
      const deleted = await chatManager.getSession(session.id);
      expect(deleted).toBeUndefined();

      // Verify other operations still work
      const newSession = await chatManager.createSession(config.id);
      expect(newSession).toBeDefined();
    });

    it('should handle config deletion and update sessions', async () => {
      // Create two configs
      const config1 = await configManager.createConfig({
        name: '配置1',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4o',
        apiKey: 'test-key-1',
        isDefault: true,
      });

      const config2 = await configManager.createConfig({
        name: '配置2',
        provider: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        modelName: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key-2',
      });

      // Delete first config
      await configManager.deleteConfig(config1.id);

      // Verify config is deleted
      const deleted = await configManager.getConfig(config1.id);
      expect(deleted).toBeUndefined();

      // Verify second config becomes default
      const remaining = await configManager.getAllConfigs();
      expect(remaining.length).toBe(1);
      expect(remaining[0].isDefault).toBe(true);
    });
  });
});
