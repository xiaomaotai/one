/**
 * Configuration Manager Tests
 * 
 * Property Tests:
 * - Property 7: Default Configuration Uniqueness
 * 
 * Unit Tests:
 * - Validation logic
 * - CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ConfigurationManager } from './config-manager';
import { deleteDB } from '../storage/db';
import type { CreateConfigInput, AIProvider } from '../../types';

// ============================================
// Test Setup
// ============================================

let configManager: ConfigurationManager;

beforeEach(async () => {
  await deleteDB();
  configManager = new ConfigurationManager();
});

afterEach(async () => {
  await deleteDB();
});

// ============================================
// Arbitrary Generators
// ============================================

const arbProvider = fc.constantFrom<AIProvider>('openai', 'anthropic', 'google', 'openai-compatible');

const arbValidConfigInput = (index: number = 0): fc.Arbitrary<CreateConfigInput> => fc.record({
  name: fc.constant(`Config ${index}`),
  provider: arbProvider,
  apiUrl: fc.constant('https://api.example.com'),
  modelName: fc.constant('test-model'),
  apiKey: fc.string({ minLength: 10, maxLength: 50 }),
  isDefault: fc.boolean()
});

// ============================================
// Property Tests
// ============================================

describe('Property 7: Default Configuration Uniqueness', () => {
  /**
   * Feature: multi-ai-chat-app, Property 7: Default Configuration Uniqueness
   * 
   * For any set of configurations, at most one configuration should be
   * marked as default at any given time.
   * 
   * **Validates: Requirements 4.5**
   */
  it('should maintain at most one default configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (count) => {
          // Clean database before each iteration
          await deleteDB();
          
          // Create multiple configs with unique names
          for (let i = 0; i < count; i++) {
            await configManager.createConfig({
              name: `Config ${i}`,
              provider: 'openai',
              apiUrl: 'https://api.openai.com/v1',
              modelName: 'gpt-4',
              apiKey: `sk-test-key-${i}`,
              isDefault: i === count - 1 // Last one is default
            });
          }

          // Verify only one default
          const configs = await configManager.getAllConfigs();
          const defaultConfigs = configs.filter(c => c.isDefault);
          
          expect(defaultConfigs.length).toBeLessThanOrEqual(1);
          
          // If there are configs, exactly one should be default
          if (configs.length > 0) {
            expect(defaultConfigs.length).toBe(1);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Setting a new default should unset the previous default
   */
  it('should unset previous default when setting new default', async () => {
    // Create two configs
    const config1 = await configManager.createConfig({
      name: 'Config 1',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-1',
      isDefault: true
    });

    const config2 = await configManager.createConfig({
      name: 'Config 2',
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      modelName: 'claude-3',
      apiKey: 'sk-test-2',
      isDefault: false
    });

    // Set config2 as default
    await configManager.setDefaultConfig(config2.id);

    // Verify
    const updated1 = await configManager.getConfig(config1.id);
    const updated2 = await configManager.getConfig(config2.id);

    expect(updated1?.isDefault).toBe(false);
    expect(updated2?.isDefault).toBe(true);

    // Verify only one default
    const configs = await configManager.getAllConfigs();
    const defaultCount = configs.filter(c => c.isDefault).length;
    expect(defaultCount).toBe(1);
  });

  /**
   * Deleting default config should set another as default
   */
  it('should set another config as default when deleting default', async () => {
    // Create two configs
    const config1 = await configManager.createConfig({
      name: 'Config 1',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-1',
      isDefault: true
    });

    await configManager.createConfig({
      name: 'Config 2',
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      modelName: 'claude-3',
      apiKey: 'sk-test-2',
      isDefault: false
    });

    // Delete default config
    await configManager.deleteConfig(config1.id);

    // Verify another is now default
    const configs = await configManager.getAllConfigs();
    expect(configs.length).toBe(1);
    expect(configs[0].isDefault).toBe(true);
  });
});

// ============================================
// Unit Tests - Validation
// ============================================

describe('Configuration Validation', () => {
  it('should validate valid config input', () => {
    const input: CreateConfigInput = {
      name: 'Test Config',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    };

    const result = configManager.validateConfigInput(input);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty name', () => {
    const input: CreateConfigInput = {
      name: '',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    };

    const result = configManager.validateConfigInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('should reject empty model name', () => {
    const input: CreateConfigInput = {
      name: 'Test',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: '',
      apiKey: 'sk-test-key'
    };

    const result = configManager.validateConfigInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'modelName')).toBe(true);
  });

  it('should reject empty API key', () => {
    const input: CreateConfigInput = {
      name: 'Test',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: ''
    };

    const result = configManager.validateConfigInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'apiKey')).toBe(true);
  });

  it('should reject invalid URL format', () => {
    const input: CreateConfigInput = {
      name: 'Test',
      provider: 'openai',
      apiUrl: 'not-a-valid-url',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    };

    const result = configManager.validateConfigInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'apiUrl')).toBe(true);
  });

  it('should require API URL for openai-compatible provider', () => {
    const input: CreateConfigInput = {
      name: 'Test',
      provider: 'openai-compatible',
      apiUrl: '',
      modelName: 'custom-model',
      apiKey: 'custom-key'
    };

    const result = configManager.validateConfigInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'apiUrl')).toBe(true);
  });
});

// ============================================
// Unit Tests - CRUD Operations
// ============================================

describe('Configuration CRUD', () => {
  it('should create a configuration', async () => {
    const config = await configManager.createConfig({
      name: 'Test Config',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    });

    expect(config.id).toBeDefined();
    expect(config.name).toBe('Test Config');
    expect(config.provider).toBe('openai');
  });

  it('should get a configuration by ID', async () => {
    const created = await configManager.createConfig({
      name: 'Test Config',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    });

    const retrieved = await configManager.getConfig(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
  });

  it('should get all configurations', async () => {
    await configManager.createConfig({
      name: 'Config 1',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-1'
    });

    await configManager.createConfig({
      name: 'Config 2',
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      modelName: 'claude-3',
      apiKey: 'sk-test-2'
    });

    const configs = await configManager.getAllConfigs();
    expect(configs.length).toBe(2);
  });

  it('should update a configuration', async () => {
    const config = await configManager.createConfig({
      name: 'Original Name',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    });

    const updated = await configManager.updateConfig(config.id, {
      name: 'Updated Name',
      modelName: 'gpt-4-turbo'
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.modelName).toBe('gpt-4-turbo');
  });

  it('should delete a configuration', async () => {
    const config = await configManager.createConfig({
      name: 'To Delete',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    });

    await configManager.deleteConfig(config.id);

    const retrieved = await configManager.getConfig(config.id);
    expect(retrieved).toBeUndefined();
  });

  it('should reject duplicate names', async () => {
    await configManager.createConfig({
      name: 'Unique Name',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-1'
    });

    await expect(configManager.createConfig({
      name: 'Unique Name',
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      modelName: 'claude-3',
      apiKey: 'sk-test-2'
    })).rejects.toThrow('已存在');
  });

  it('should set first config as default automatically', async () => {
    const config = await configManager.createConfig({
      name: 'First Config',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-key'
    });

    expect(config.isDefault).toBe(true);
  });

  it('should get default configuration', async () => {
    await configManager.createConfig({
      name: 'Config 1',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test-1',
      isDefault: true
    });

    const defaultConfig = await configManager.getDefaultConfig();
    expect(defaultConfig).toBeDefined();
    expect(defaultConfig?.name).toBe('Config 1');
  });
});

// ============================================
// Unit Tests - Error Handling
// ============================================

describe('Error Handling', () => {
  it('should throw error when updating non-existent config', async () => {
    await expect(configManager.updateConfig('non-existent', { name: 'New Name' }))
      .rejects.toThrow('配置不存在');
  });

  it('should throw error when setting non-existent config as default', async () => {
    await expect(configManager.setDefaultConfig('non-existent'))
      .rejects.toThrow('配置不存在');
  });

  it('should handle deleting non-existent config gracefully', async () => {
    // Should not throw
    await configManager.deleteConfig('non-existent');
  });

  it('should throw error for invalid config input', async () => {
    await expect(configManager.createConfig({
      name: '',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      apiKey: 'sk-test'
    })).rejects.toThrow('配置验证失败');
  });
});
