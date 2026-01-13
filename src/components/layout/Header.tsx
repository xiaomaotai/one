/**
 * Header Component
 * 
 * Application header with model indicator and model selector.
 * Shows the current session's model configuration.
 * 
 * Requirements: 8.1, 8.2
 */
import React, { useState, useMemo } from 'react';
import { useConfigStore } from '../../store/config-store';
import { useChatStore, getCurrentSession } from '../../store/chat-store';
import { chatManager } from '../../lib/chat';
import { PROVIDER_NAMES } from '../../types';

interface HeaderProps {
  modelName?: string;
}

export const Header: React.FC<HeaderProps> = () => {
  const [showSelector, setShowSelector] = useState(false);
  const configs = useConfigStore((state) => state.configs);
  const currentSession = useChatStore(getCurrentSession);
  const updateSession = useChatStore((state) => state.updateSession);

  // Get the config for current session (not global currentConfigId)
  const sessionConfig = useMemo(() => {
    if (!currentSession) return undefined;
    return configs.find((c) => c.id === currentSession.configId);
  }, [currentSession, configs]);

  const handleSelectConfig = async (configId: string) => {
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
    <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 gap-3">
      {/* Current Session Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <h2 className="text-lg font-medium text-white truncate">
          {currentSession?.title || '新对话'}
        </h2>
      </div>

      {/* Model Selector */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors max-w-[200px]"
        >
          {sessionConfig ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
              <span className="text-sm text-white truncate max-w-[120px]">{sessionConfig.name}</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-400">选择模型</span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* Dropdown */}
        {showSelector && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowSelector(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
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
                            sessionConfig?.id === config.id
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{config.name}</span>
                            {config.isDefault && (
                              <span className="text-xs bg-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">
                                默认
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
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
