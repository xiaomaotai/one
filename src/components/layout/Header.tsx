/**
 * Header Component
 *
 * Application header with model indicator and model selector.
 * Shows the current session's model configuration.
 * Shows confirmation dialog when switching model during streaming.
 *
 * Requirements: 8.1, 8.2
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useConfigStore } from '../../store/config-store';
import { useChatStore, getCurrentSession } from '../../store/chat-store';
import { useThemeStore } from '../../store/theme-store';
import { chatManager } from '../../lib/chat';
import { PROVIDER_NAMES } from '../../types';

interface HeaderProps {
  modelName?: string;
}

export const Header: React.FC<HeaderProps> = () => {
  const [showSelector, setShowSelector] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingConfigId, setPendingConfigId] = useState<string | null>(null);

  const configs = useConfigStore((state) => state.configs);
  const currentSession = useChatStore(getCurrentSession);
  const updateSession = useChatStore((state) => state.updateSession);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const setStreaming = useChatStore((state) => state.setStreaming);
  const lastSendTime = useChatStore((state) => state.lastSendTime);
  const setLastSendTime = useChatStore((state) => state.setLastSendTime);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Check if we should show confirmation (streaming or has pending conversation)
  const shouldShowConfirmation = useCallback(() => {
    // Show confirmation if streaming or if there's an active conversation (lastSendTime set)
    return isStreaming || lastSendTime !== null;
  }, [isStreaming, lastSendTime]);

  // Get the config for current session (not global currentConfigId)
  const sessionConfig = useMemo(() => {
    if (!currentSession) return undefined;
    return configs.find((c) => c.id === currentSession.configId);
  }, [currentSession, configs]);

  // Actually switch the config
  const doSwitchConfig = useCallback(async (configId: string) => {
    if (currentSession) {
      try {
        // Cancel any active stream first
        if (isStreaming) {
          chatManager.cancelStream(currentSession.id);
          setStreaming(false);
        }
        // Clear lastSendTime when switching
        setLastSendTime(null);
        await chatManager.switchSessionConfig(currentSession.id, configId);
        updateSession(currentSession.id, { configId });
      } catch (error) {
        console.error('切换配置失败:', error);
      }
    }
    setShowConfirmDialog(false);
    setPendingConfigId(null);
  }, [currentSession, isStreaming, setStreaming, setLastSendTime, updateSession]);

  const handleSelectConfig = useCallback(async (configId: string) => {
    setShowSelector(false);

    // If same config, do nothing
    if (sessionConfig?.id === configId) {
      return;
    }

    // If streaming or recently sent message, show confirmation dialog
    if (shouldShowConfirmation()) {
      setPendingConfigId(configId);
      setShowConfirmDialog(true);
      return;
    }

    // Otherwise, switch directly
    await doSwitchConfig(configId);
  }, [sessionConfig?.id, shouldShowConfirmation, doSwitchConfig]);

  const handleConfirmSwitch = useCallback(() => {
    if (pendingConfigId) {
      doSwitchConfig(pendingConfigId);
    }
  }, [pendingConfigId, doSwitchConfig]);

  const handleCancelSwitch = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingConfigId(null);
  }, []);

  return (
    <>
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
            aria-label="选择模型"
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

      {/* Confirmation Dialog for switching model during streaming */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-model-title"
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCancelSwitch} />
          <div className={`relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border`}>
            <h3 id="switch-model-title" className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              切换模型
            </h3>
            <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
              当前正在生成回复，切换模型将中断当前对话。确定要切换吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelSwitch}
                className={`flex-1 px-4 py-2 ${isDark ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} ${isDark ? 'text-white' : 'text-gray-700'} rounded-lg transition-colors`}
              >
                取消
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                确定切换
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
