/**
 * Header Component
 * 
 * Application header with model indicator and model selector.
 * 
 * Requirements: 8.1, 8.2
 */
import React, { useState } from 'react';
import { useConfigStore, getCurrentConfig } from '../../store/config-store';
import { useChatStore, getCurrentSession } from '../../store/chat-store';
import { chatManager } from '../../lib/chat';
import { PROVIDER_NAMES } from '../../types';

interface HeaderProps {
  modelName?: string;
}

export const Header: React.FC<HeaderProps> = () => {
  const [showSelector, setShowSelector] = useState(false);
  const configs = useConfigStore((state) => state.configs);
  const currentConfig = useConfigStore(getCurrentConfig);
  const setCurrentConfig = useConfigStore((state) => state.setCurrentConfig);
  const currentSession = useChatStore(getCurrentSession);
  const updateSession = useChatStore((state) => state.updateSession);

  const handleSelectConfig = async (configId: string) => {
    setCurrentConfig(configId);
    setShowSelector(false);
    
    // Update current session's config if there is one
    if (currentSession) {
      try {
        await chatManager.switchSessionConfig(currentSession.id, configId);
        updateSession(currentSession.id, { configId });
      } catch (error) {
        console.error('切换配置失败:', error);
      }
    }
  };

  return (
    <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
      {/* Current Session Title */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-medium text-white">
          {currentSession?.title || '新对话'}
        </h2>
      </div>

      {/* Model Selector */}
      <div className="relative">
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          {currentConfig ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-sm text-white">{currentConfig.name}</span>
              <span className="text-xs text-gray-400">
                ({PROVIDER_NAMES[currentConfig.provider]})
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">选择模型</span>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {showSelector && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowSelector(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
              <div className="p-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase px-2 py-1">
                  选择模型
                </h3>
                {configs.length === 0 ? (
                  <p className="text-sm text-gray-500 px-2 py-2">
                    暂无配置，请先添加
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {configs.map((config) => (
                      <li key={config.id}>
                        <button
                          onClick={() => handleSelectConfig(config.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            currentConfig?.id === config.id
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{config.name}</span>
                            {config.isDefault && (
                              <span className="text-xs bg-gray-600 px-1.5 py-0.5 rounded">
                                默认
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {PROVIDER_NAMES[config.provider]} · {config.modelName}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
