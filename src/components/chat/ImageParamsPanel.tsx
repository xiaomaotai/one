/**
 * Image Generation Parameters Panel
 * 
 * Displays and allows editing of image generation parameters.
 * Only shown when using image-generation provider.
 * Only includes: size, steps, and guidanceScale parameters.
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
    // Only reset the 3 supported parameters
    onChange({
      ...params,
      size: DEFAULT_IMAGE_PARAMS.size,
      steps: DEFAULT_IMAGE_PARAMS.steps,
      guidanceScale: DEFAULT_IMAGE_PARAMS.guidanceScale
    });
  };

  return (
    <div className={`border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
      {/* Header - always visible, no emoji/image before text */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full px-4 py-2 flex items-center justify-between ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'} transition-colors`}
      >
        <div className="flex items-center gap-2">
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

      {/* Collapsed summary - only show the 3 supported parameters */}
      {isCollapsed && (
        <div className={`px-4 pb-2 flex flex-wrap gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            {params.size || DEFAULT_IMAGE_PARAMS.size}
          </span>
          <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            {params.steps || DEFAULT_IMAGE_PARAMS.steps} 步
          </span>
          <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            CFG {params.guidanceScale || DEFAULT_IMAGE_PARAMS.guidanceScale}
          </span>
        </div>
      )}

      {/* Expanded panel - only 3 parameters: size, steps, guidanceScale */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4">
          {/* Size */}
          <div>
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
              图片尺寸
            </label>
            <select
              value={params.size || DEFAULT_IMAGE_PARAMS.size}
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
              推理步数: {params.steps || DEFAULT_IMAGE_PARAMS.steps}
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={params.steps || DEFAULT_IMAGE_PARAMS.steps}
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
              引导强度 (CFG): {params.guidanceScale || DEFAULT_IMAGE_PARAMS.guidanceScale}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={params.guidanceScale || DEFAULT_IMAGE_PARAMS.guidanceScale}
              onChange={(e) => handleChange('guidanceScale', parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-600"
            />
            <div className={`flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              <span>1 (自由)</span>
              <span>20 (严格)</span>
            </div>
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