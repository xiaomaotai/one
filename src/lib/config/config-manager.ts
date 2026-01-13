/**
 * Configuration Manager
 * 
 * Manages AI model configurations with validation, CRUD operations,
 * and default configuration handling.
 * 
 * Requirements: 1.1, 1.2, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type {
  ModelConfig,
  CreateConfigInput,
  UpdateConfigInput,
  ConfigValidationResult,
  ConfigValidationError,
  AIProvider
} from '../../types';
import { storageManager } from '../storage';
import { createModelConfig } from '../factories';
import { createAdapter, getDefaultApiUrl } from '../adapters';

export class ConfigurationManager {
  /**
   * Create a new configuration
   */
  async createConfig(input: CreateConfigInput): Promise<ModelConfig> {
    // Validate input
    const validation = this.validateConfigInput(input);
    if (!validation.isValid) {
      throw new Error(`配置验证失败: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check for duplicate names
    const existing = await storageManager.loadConfigs();
    if (existing.some(c => c.name === input.name)) {
      throw new Error(`配置名称 "${input.name}" 已存在`);
    }

    // Create config
    const config = createModelConfig(input);

    // If this is the first config or marked as default, set it as default
    if (input.isDefault || existing.length === 0) {
      config.isDefault = true;
      // Unset other defaults
      for (const c of existing) {
        if (c.isDefault) {
          c.isDefault = false;
          await storageManager.saveConfig(c);
        }
      }
    }

    await storageManager.saveConfig(config);
    return config;
  }

  /**
   * Get a configuration by ID
   */
  async getConfig(id: string): Promise<ModelConfig | undefined> {
    return storageManager.getConfig(id);
  }

  /**
   * Get all configurations
   */
  async getAllConfigs(): Promise<ModelConfig[]> {
    return storageManager.loadConfigs();
  }

  /**
   * Get the default configuration
   */
  async getDefaultConfig(): Promise<ModelConfig | undefined> {
    return storageManager.getDefaultConfig();
  }

  /**
   * Update a configuration
   */
  async updateConfig(id: string, updates: UpdateConfigInput): Promise<ModelConfig> {
    const existing = await storageManager.getConfig(id);
    if (!existing) {
      throw new Error(`配置不存在: ${id}`);
    }

    // Check for duplicate names if name is being updated
    if (updates.name && updates.name !== existing.name) {
      const allConfigs = await storageManager.loadConfigs();
      if (allConfigs.some(c => c.name === updates.name && c.id !== id)) {
        throw new Error(`配置名称 "${updates.name}" 已存在`);
      }
    }

    // Merge updates
    const updated: ModelConfig = {
      ...existing,
      ...updates
    };

    // Validate the updated config
    const validation = this.validateConfigInput({
      name: updated.name,
      provider: updated.provider,
      apiUrl: updated.apiUrl,
      modelName: updated.modelName,
      apiKey: updated.apiKey
    });

    if (!validation.isValid) {
      throw new Error(`配置验证失败: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    await storageManager.saveConfig(updated);
    return updated;
  }

  /**
   * Delete a configuration
   */
  async deleteConfig(id: string): Promise<void> {
    const config = await storageManager.getConfig(id);
    if (!config) {
      return; // Already deleted
    }

    await storageManager.deleteConfig(id);

    // If deleted config was default, set another as default
    if (config.isDefault) {
      const remaining = await storageManager.loadConfigs();
      if (remaining.length > 0) {
        await this.setDefaultConfig(remaining[0].id);
      }
    }
  }

  /**
   * Set a configuration as default
   */
  async setDefaultConfig(id: string): Promise<void> {
    const config = await storageManager.getConfig(id);
    if (!config) {
      throw new Error(`配置不存在: ${id}`);
    }

    await storageManager.setDefaultConfig(id);
  }

  /**
   * Validate configuration input
   */
  validateConfigInput(input: CreateConfigInput): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      errors.push({ field: 'name', message: '配置名称不能为空' });
    } else if (input.name.length > 100) {
      errors.push({ field: 'name', message: '配置名称不能超过100个字符' });
    }

    // Validate provider
    const validProviders: AIProvider[] = ['openai', 'anthropic', 'google', 'openai-compatible', 'image-generation'];
    if (!validProviders.includes(input.provider)) {
      errors.push({ field: 'provider', message: '无效的提供商类型' });
    }

    // Validate API URL
    if (input.provider === 'openai-compatible' || input.provider === 'image-generation') {
      if (!input.apiUrl || input.apiUrl.trim().length === 0) {
        errors.push({ field: 'apiUrl', message: '此模式需要提供API URL' });
      }
    }

    if (input.apiUrl && input.apiUrl.trim().length > 0) {
      try {
        new URL(input.apiUrl);
      } catch {
        errors.push({ field: 'apiUrl', message: 'API URL格式无效' });
      }
    }

    // Validate model name
    if (!input.modelName || input.modelName.trim().length === 0) {
      errors.push({ field: 'modelName', message: '模型名称不能为空' });
    }

    // Validate API key
    if (!input.apiKey || input.apiKey.trim().length === 0) {
      errors.push({ field: 'apiKey', message: 'API密钥不能为空' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Test a configuration by validating credentials
   */
  async testConfig(config: ModelConfig): Promise<{ success: boolean; message: string }> {
    try {
      const adapter = createAdapter(config);
      const isValid = await adapter.validateCredentials();
      
      if (isValid) {
        return { success: true, message: '配置验证成功' };
      } else {
        return { success: false, message: 'API密钥或URL无效' };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '验证失败'
      };
    }
  }

  /**
   * Get default API URL for a provider
   */
  getDefaultApiUrl(provider: AIProvider): string {
    return getDefaultApiUrl(provider);
  }

  /**
   * Check if a provider is an image generation provider
   */
  isImageGenerationProvider(provider: AIProvider): boolean {
    return provider === 'image-generation';
  }
}

// Export singleton instance
export const configManager = new ConfigurationManager();
