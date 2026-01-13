/**
 * Image Generation Parameters Panel
 * 
 * Displays and allows editing of image generation parameters.
 * Only shown when using image-generation provider.
 * 
 */
import React, { useState } from 'react';
import type { ImageGenerationParams } from '../../types';
import { DEFAULT_IMAGE_PARAMS } from '../../types';
import { useThemeStore } from '../../store/theme-store';

interface ImageParamsPanelProps {
  params: ImageGenerationParams;
  onChange: (params: ImageGenerationParams) => void;
  collapsed?: boolean;
}

const SIZE_OPTIONS = [
  { value: '512x512', label: '512×512' },
  { value: '768x768', label: '768×768' },
  { value: '1024x1024', label: '1024×1024' },
  { value: '1024x768', label: '1024×768 (横向)' },
  { value: '768x1024', label: '768×1024 (纵向)' },
];

export const ImageParamsPanel: React.FC<ImageParamsPanelProps> = ({
  params,
  onChange,
  collapsed: initialCollapsed = true
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  const handleChange = (key: keyof ImageGenerationParams, value: string | number | undefined) => {
    onChange({
      ...params,
      [key]: value
    });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_IMAGE_PARAMS });
  };

  const handleRandomSeed = () => {
    onChange({
      ...params,
      seed: Math.floor(Math.random() * 2147483647)
    });
  };

  return (
    <div className={`border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full px-4 py-2 flex items-center justify-between ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            图片生成参数
          </span>
          {!isCollapsed && (
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              (点击收起)
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'} transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsed summary */}
      {isCollapsed && (
        <div className={`px-4 pb-2 flex flex-wrap gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            {params.size || '1024x1024'}
          </span>
          {params.steps && (
            <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              {params.steps} 步
            </span>
          )}
          {params.guidanceScale && (
            <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              CFG {params.guidanceScale}
            </span>
          )}
          {params.seed !== undefined && (
            <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              种子 {params.seed}
            </span>
          )}
        </div>
      )}

      {/* Expanded panel */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4">
          {/* Size */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              图片尺寸
            </label>
            <select
              value={params.size || '1024x1024'}
              onChange={(e) => handleChange('size', e.target.value as ImageGenerationParams['size'])}
              className={`w-full px-3 py-1.5 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              {SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Steps */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              推理步数: {params.steps || 30}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={params.steps || 30}
              onChange={(e) => handleChange('steps', parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-600"
            />
            <div className={`flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              <span>10 (快)</span>
              <span>100 (精细)</span>
            </div>
          </div>

          {/* Guidance Scale */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              引导强度 (CFG): {params.guidanceScale || 7.5}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={params.guidanceScale || 7.5}
              onChange={(e) => handleChange('guidanceScale', parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-600"
            />
            <div className={`flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              <span>1 (自由)</span>
              <span>20 (严格)</span>
            </div>
          </div>

          {/* Seed */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              随机种子 (留空为随机)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={params.seed ?? ''}
                onChange={(e) => handleChange('seed', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="随机"
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-500' : 'bg-white text-gray-900 border-gray-300 placeholder-gray-400'} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={handleRandomSeed}
                className={`px-3 py-1.5 text-sm rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} transition-colors`}
                title="生成随机种子"
              >
                🎲
              </button>
            </div>
          </div>

          {/* Negative Prompt */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              负面提示词 (避免生成的内容)
            </label>
            <textarea
              value={params.negativePrompt || ''}
              onChange={(e) => handleChange('negativePrompt', e.target.value)}
              placeholder="例如: blurry, low quality, distorted"
              rows={2}
              className={`w-full px-3 py-1.5 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-500' : 'bg-white text-gray-900 border-gray-300 placeholder-gray-400'} border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
            />
          </div>

          {/* Style */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              风格预设 (可选)
            </label>
            <input
              type="text"
              value={params.style || ''}
              onChange={(e) => handleChange('style', e.target.value)}
              placeholder="例如: anime, photorealistic, oil painting"
              className={`w-full px-3 py-1.5 text-sm rounded-lg ${isDark ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-500' : 'bg-white text-gray-900 border-gray-300 placeholder-gray-400'} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Reset button */}
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className={`px-3 py-1.5 text-xs rounded-lg ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'} transition-colors`}
            >
              重置为默认
            </button>
          </div>
        </div>
      )}
    </div>
  );
};