/**
 * Configuration Form Component
 * 
 * Form for creating and editing AI model configurations.
 * 
 * Requirements: 4.2, 4.3
 */
import React, { useState, useEffect } from 'react';
import type { ModelConfig, AIProvider, CreateConfigInput } from '../../types';
import { PROVIDER_NAMES, DEFAULT_API_URLS } from '../../types';

interface ConfigFormProps {
  config?: ModelConfig;
  onSubmit: (data: CreateConfigInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google', 'openai-compatible', 'image-generation'];

const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  'openai': [
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4.5',
    'gpt-4o',
    'gpt-4o-mini',
  ],
  'anthropic': [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-1-20250805',
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
  ],
  'google': [
    'gemini-3-pro',
    'gemini-3-flash',
    'gemini-3-deep-think',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
  'openai-compatible': [],
  'image-generation': [],
};

// 常用文生图 API 预设
const IMAGE_API_PRESETS = [
  {
    name: 'ModelScope',
    url: 'https://api-inference.modelscope.cn',
    models: ['Qwen/Qwen-Image-2512', 'Tongyi-MAI/Z-Image-Turbo'],
    tokenPrefix: 'ms-'
  },
  {
    name: '自定义',
    url: '',
    models: [],
    tokenPrefix: ''
  }
];

export const ConfigForm: React.FC<ConfigFormProps> = ({
  config,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [name, setName] = useState(config?.name ?? '');
  const [provider, setProvider] = useState<AIProvider>(config?.provider ?? 'openai');
  const [apiUrl, setApiUrl] = useState(config?.apiUrl ?? DEFAULT_API_URLS['openai']);
  const [modelName, setModelName] = useState(config?.modelName ?? 'gpt-5');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [isDefault, setIsDefault] = useState(config?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPreset, setSelectedPreset] = useState(0);

  // Update API URL and model when provider changes
  useEffect(() => {
    if (!config) {
      setApiUrl(DEFAULT_API_URLS[provider]);
      const defaultModels = DEFAULT_MODELS[provider];
      if (defaultModels.length > 0) {
        setModelName(defaultModels[0]);
      } else {
        setModelName('');
      }
      // Reset preset for image generation
      if (provider === 'image-generation') {
        setSelectedPreset(0);
        setApiUrl(IMAGE_API_PRESETS[0].url);
        if (IMAGE_API_PRESETS[0].models.length > 0) {
          setModelName(IMAGE_API_PRESETS[0].models[0]);
        }
      }
    }
  }, [provider, config]);

  // Handle preset change for image generation
  const handlePresetChange = (presetIndex: number) => {
    setSelectedPreset(presetIndex);
    const preset = IMAGE_API_PRESETS[presetIndex];
    setApiUrl(preset.url);
    if (preset.models.length > 0) {
      setModelName(preset.models[0]);
    } else {
      setModelName('');
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = '请输入配置名称';
    }
    
    if (!apiKey.trim()) {
      newErrors.apiKey = '请输入 API Key';
    }
    
    if (!modelName.trim()) {
      newErrors.modelName = '请输入模型名称';
    }
    
    if ((provider === 'openai-compatible' || provider === 'image-generation') && !apiUrl.trim()) {
      newErrors.apiUrl = '请输入 API 地址';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    onSubmit({
      name: name.trim(),
      provider,
      apiUrl: apiUrl.trim(),
      modelName: modelName.trim(),
      apiKey: apiKey.trim(),
      isDefault,
    });
  };

  // Check if this is an image generation provider
  const isImageProvider = provider === 'image-generation';
  const currentPreset = IMAGE_API_PRESETS[selectedPreset];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">配置名称 <span className="text-gray-400 font-normal">(最多20字)</span></label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          maxLength={20}
          placeholder={isImageProvider ? "例如：我的文生图" : "例如：我的 GPT-4"}
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
      </div>

      {/* Provider */}
      <div>
        <label className="block text-sm font-medium mb-1">AI 提供商</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider)}
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{PROVIDER_NAMES[p]}</option>
          ))}
        </select>
        {isImageProvider && (
          <p className="text-blue-400 text-xs mt-1">
            🎨 文生图模式：输入文字描述，AI 将生成对应的图片
          </p>
        )}
      </div>

      {/* Image API Preset (only for image-generation) */}
      {isImageProvider && (
        <div>
          <label className="block text-sm font-medium mb-1">API 预设</label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(Number(e.target.value))}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {IMAGE_API_PRESETS.map((preset, index) => (
              <option key={index} value={index}>{preset.name}</option>
            ))}
          </select>
          <p className="text-gray-400 text-xs mt-1">
            选择预设可快速配置常用的文生图 API
          </p>
        </div>
      )}

      {/* API URL */}
      <div>
        <label className="block text-sm font-medium mb-1">
          API 地址
          {provider !== 'openai-compatible' && provider !== 'image-generation' && (
            <span className="text-gray-400 font-normal ml-2">(可选，使用默认地址)</span>
          )}
        </label>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder={isImageProvider ? "例如：https://api-inference.modelscope.cn" : (DEFAULT_API_URLS[provider] || '请输入 API 地址')}
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.apiUrl && <p className="text-red-400 text-sm mt-1">{errors.apiUrl}</p>}
        {isImageProvider && (
          <p className="text-gray-400 text-xs mt-1">
            API 需支持 POST /v1/images/generations 接口
          </p>
        )}
      </div>

      {/* Model Name */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {isImageProvider ? '图像模型' : '模型名称'}
        </label>
        {DEFAULT_MODELS[provider].length > 0 ? (
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEFAULT_MODELS[provider].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="custom">自定义...</option>
          </select>
        ) : isImageProvider && currentPreset.models.length > 0 ? (
          <>
            <select
              value={currentPreset.models.includes(modelName) ? modelName : 'custom'}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {currentPreset.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="custom">自定义...</option>
            </select>
            {!currentPreset.models.includes(modelName) && modelName !== 'custom' && (
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="请输入模型名称"
                className="w-full px-3 py-2 mt-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </>
        ) : (
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={isImageProvider ? "例如：Qwen/Qwen-Image-2512" : "请输入模型名称"}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {modelName === 'custom' && (
          <input
            type="text"
            onChange={(e) => setModelName(e.target.value)}
            placeholder="请输入自定义模型名称"
            className="w-full px-3 py-2 mt-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {errors.modelName && <p className="text-red-400 text-sm mt-1">{errors.modelName}</p>}
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {isImageProvider ? 'API Token' : 'API Key'}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isImageProvider && currentPreset.tokenPrefix ? `请输入 Token (${currentPreset.tokenPrefix}xxx)` : "请输入 API Key"}
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.apiKey && <p className="text-red-400 text-sm mt-1">{errors.apiKey}</p>}
      </div>

      {/* Default */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)]"
        />
        <label htmlFor="isDefault" className="text-sm">设为默认配置</label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isLoading ? '保存中...' : (config ? '更新配置' : '添加配置')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
};
