/**
 * Storage Manager Implementation
 * 
 * Provides CRUD operations for model configurations and chat sessions
 * using IndexedDB as the backend storage.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import type {
  ModelConfig,
  ChatSession,
  Message,
  IStorageManager,
  SerializedModelConfig
} from '../../types';
import {
  serializeConfig,
  deserializeConfig,
  serializeSession,
  deserializeSession,
  serializeMessage
} from '../utils/serialization';
import { getDB } from './db';

export class StorageManager implements IStorageManager {
  // ============================================
  // Configuration Operations
  // ============================================

  /**
   * Save a model configuration to storage
   */
  async saveConfig(config: ModelConfig): Promise<void> {
    const db = await getDB();
    const serialized = serializeConfig(config);
    await db.put('configs', serialized);
  }

  /**
   * Load all model configurations from storage
   * Sorted by sortOrder (ascending), then by createdAt (descending) for configs without sortOrder
   */
  async loadConfigs(): Promise<ModelConfig[]> {
    const db = await getDB();
    const serialized = await db.getAll('configs');
    const configs = serialized.map(deserializeConfig);
    
    // Sort by sortOrder first, then by createdAt for items without sortOrder
    return configs.sort((a, b) => {
      // If both have sortOrder, sort by sortOrder
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder;
      }
      // If only a has sortOrder, a comes first
      if (a.sortOrder !== undefined) {
        return -1;
      }
      // If only b has sortOrder, b comes first
      if (b.sortOrder !== undefined) {
        return 1;
      }
      // If neither has sortOrder, sort by createdAt (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Get a specific configuration by ID
   */
  async getConfig(id: string): Promise<ModelConfig | undefined> {
    const db = await getDB();
    const serialized = await db.get('configs', id);
    return serialized ? deserializeConfig(serialized) : undefined;
  }

  /**
   * Delete a configuration by ID
   */
  async deleteConfig(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('configs', id);
  }

  /**
   * Get the default configuration
   */
  async getDefaultConfig(): Promise<ModelConfig | undefined> {
    const db = await getDB();
    const all = await db.getAll('configs');
    const defaultConfig = all.find(c => c.isDefault);
    return defaultConfig ? deserializeConfig(defaultConfig) : undefined;
  }

  /**
   * Set a configuration as default (and unset others)
   */
  async setDefaultConfig(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('configs', 'readwrite');
    const store = tx.objectStore('configs');
    
    // Get all configs
    const all = await store.getAll();
    
    // Update each config
    for (const config of all) {
      const updated: SerializedModelConfig = {
        ...config,
        isDefault: config.id === id
      };
      await store.put(updated);
    }
    
    await tx.done;
  }

  /**
   * Save configs order (update sortOrder for all configs)
   */
  async saveConfigsOrder(configIds: string[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('configs', 'readwrite');
    const store = tx.objectStore('configs');
    
    // Update sortOrder for each config
    for (let i = 0; i < configIds.length; i++) {
      const config = await store.get(configIds[i]);
      if (config) {
        config.sortOrder = i;
        await store.put(config);
      }
    }
    
    await tx.done;
  }

  // ============================================
  // Session Operations
  // ============================================

  /**
   * Save a chat session to storage
   */
  async saveSession(session: ChatSession): Promise<void> {
    const db = await getDB();
    const serialized = serializeSession(session);
    await db.put('sessions', serialized);
  }

  /**
   * Load a specific session by ID
   */
  async loadSession(id: string): Promise<ChatSession | undefined> {
    const db = await getDB();
    const serialized = await db.get('sessions', id);
    return serialized ? deserializeSession(serialized) : undefined;
  }

  /**
   * Load all sessions from storage
   */
  async loadAllSessions(): Promise<ChatSession[]> {
    const db = await getDB();
    const serialized = await db.getAll('sessions');
    // Sort by updatedAt descending (most recent first)
    const sorted = serialized.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted.map(deserializeSession);
  }

  /**
   * Delete a session by ID
   */
  async deleteSession(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('sessions', id);
  }

  /**
   * Get sessions by config ID
   */
  async getSessionsByConfig(configId: string): Promise<ChatSession[]> {
    const db = await getDB();
    const serialized = await db.getAllFromIndex('sessions', 'by-config', configId);
    return serialized.map(deserializeSession);
  }

  // ============================================
  // Message Operations
  // ============================================

  /**
   * Save a message to a session
   * This updates the session with the new message
   */
  async saveMessage(message: Message): Promise<void> {
    const db = await getDB();
    const session = await db.get('sessions', message.sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${message.sessionId}`);
    }

    const serializedMessage = serializeMessage(message);
    
    // Check if message already exists (update) or is new (add)
    const existingIndex = session.messages.findIndex(m => m.id === message.id);
    
    if (existingIndex >= 0) {
      session.messages[existingIndex] = serializedMessage;
    } else {
      session.messages.push(serializedMessage);
    }
    
    // Update session's updatedAt
    session.updatedAt = new Date().toISOString();
    
    await db.put('sessions', session);
  }

  /**
   * Load all messages for a session
   */
  async loadMessages(sessionId: string): Promise<Message[]> {
    const session = await this.loadSession(sessionId);
    return session?.messages ?? [];
  }

  /**
   * Delete a message from a session
   */
  async deleteMessage(sessionId: string, messageId: string): Promise<void> {
    const db = await getDB();
    const session = await db.get('sessions', sessionId);
    
    if (!session) {
      return; // Session doesn't exist, nothing to delete
    }

    session.messages = session.messages.filter(m => m.id !== messageId);
    session.updatedAt = new Date().toISOString();
    
    await db.put('sessions', session);
  }

  // ============================================
  // Utility Operations
  // ============================================

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['configs', 'sessions'], 'readwrite');
    await tx.objectStore('configs').clear();
    await tx.objectStore('sessions').clear();
    await tx.done;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ configCount: number; sessionCount: number; messageCount: number }> {
    const db = await getDB();
    const configs = await db.count('configs');
    const sessions = await db.getAll('sessions');
    const messageCount = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    
    return {
      configCount: configs,
      sessionCount: sessions.length,
      messageCount
    };
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
