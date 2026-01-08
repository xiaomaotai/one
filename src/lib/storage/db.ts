/**
 * IndexedDB Database Configuration
 * 
 * Uses the 'idb' library for a Promise-based IndexedDB wrapper.
 * Database stores:
 * - configs: Model configurations
 * - sessions: Chat sessions with messages
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SerializedModelConfig, SerializedChatSession } from '../../types';

// Database name and version
const DB_NAME = 'multi-ai-chat';
const DB_VERSION = 1;

// Database schema interface
interface ChatDBSchema extends DBSchema {
  configs: {
    key: string;
    value: SerializedModelConfig;
    indexes: {
      'by-name': string;
      'by-default': number;
    };
  };
  sessions: {
    key: string;
    value: SerializedChatSession;
    indexes: {
      'by-config': string;
      'by-updated': string;
    };
  };
}

// Database instance (singleton)
let dbInstance: IDBPDatabase<ChatDBSchema> | null = null;

/**
 * Get or create the database instance
 */
export async function getDB(): Promise<IDBPDatabase<ChatDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ChatDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      // Handle database upgrades
      if (oldVersion < 1) {
        // Create configs store
        const configStore = db.createObjectStore('configs', { keyPath: 'id' });
        configStore.createIndex('by-name', 'name');
        configStore.createIndex('by-default', 'isDefault');

        // Create sessions store
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('by-config', 'configId');
        sessionStore.createIndex('by-updated', 'updatedAt');
      }
    },
    blocked() {
      console.warn('Database blocked - another tab may have an older version open');
    },
    blocking() {
      // Close the database if we're blocking another tab
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      dbInstance = null;
    },
  });

  return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete the entire database (for testing/reset)
 */
export async function deleteDB(): Promise<void> {
  await closeDB();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('Database deletion blocked');
      resolve();
    };
  });
}
