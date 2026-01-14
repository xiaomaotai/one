/**
 * Settings Page
 * 
 * Manages AI model configurations with CRUD operations.
 * Supports light/dark theme.
 * Preserves scroll position when app is backgrounded/resumed.
 * Supports drag-and-drop reordering of configs with smooth animations.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '../store/config-store';
import { useThemeStore } from '../store/theme-store';
import { configManager } from '../lib/config';
import { ConfigForm } from '../components/settings';
import { useScrollRestore } from '../lib/utils/use-scroll-restore';
import type { ModelConfig, CreateConfigInput } from '../types';
import { PROVIDER_NAMES } from '../types';

type ViewMode = 'list' | 'create' | 'edit';

// Delete confirmation modal component
const DeleteModal: React.FC<{
  configName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}> = ({ configName, onConfirm, onCancel, isDark }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onCancel} />
    <div className={`relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border`}>
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>确认删除</h3>
      <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
        确定要删除配置 "<span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{configName}</span>" 吗？此操作无法撤销。
      </p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          确定删除
        </button>
        <button
          onClick={onCancel}
          className={`flex-1 px-4 py-2 ${isDark ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} ${isDark ? 'text-white' : 'text-gray-700'} rounded-lg transition-colors`}
        >
          取消
        </button>
      </div>
    </div>
  </div>
);

// Check if provider is image generation type
const isImageProvider = (provider: string): boolean => {
  return provider === 'image-generation';
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingConfig, setEditingConfig] = useState<ModelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfig, setDeleteConfigState] = useState<ModelConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0); // Y offset from original position
  const [isDragging, setIsDragging] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; scrollTop: number } | null>(null);
  const itemHeightsRef = useRef<number[]>([]);
  const itemOffsetsRef = useRef<number[]>([]);
  const containerScrollTopRef = useRef(0);

  // Scroll container refs for different views
  const listContainerRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  // Use scroll restore hook for both containers
  useScrollRestore(listContainerRef);
  useScrollRestore(formContainerRef);

  const { configs, setConfigs, addConfig, updateConfig, deleteConfig: removeConfig, setDefault, reorderConfigs } = useConfigStore();
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Calculate which index the dragged item should be at based on current offset
  const getTargetIndex = useCallback((currentIndex: number, offset: number): number => {
    if (itemHeightsRef.current.length === 0) return currentIndex;
    
    const itemHeight = itemHeightsRef.current[currentIndex] || 80;
    const gap = 12; // space-y-3 = 0.75rem = 12px
    const totalItemHeight = itemHeight + gap;
    
    // Calculate how many positions we've moved
    const positionsMoved = Math.round(offset / totalItemHeight);
    let targetIndex = currentIndex + positionsMoved;
    
    // Clamp to valid range
    targetIndex = Math.max(0, Math.min(configs.length - 1, targetIndex));
    
    return targetIndex;
  }, [configs.length]);

  // Handle back to chat
  const handleBack = () => {
    navigate('/');
  };

  // Load configs on mount
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        setIsLoading(true);
        const loadedConfigs = await configManager.getAllConfigs();
        setConfigs(loadedConfigs);
      } catch (error) {
        console.error('加载配置失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfigs();
  }, [setConfigs]);

  // Measure item heights after render
  useEffect(() => {
    if (itemsContainerRef.current) {
      const items = itemsContainerRef.current.children;
      const heights: number[] = [];
      const offsets: number[] = [];
      let currentOffset = 0;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as HTMLElement;
        heights.push(item.offsetHeight);
        offsets.push(currentOffset);
        currentOffset += item.offsetHeight + 12; // 12px gap
      }
      
      itemHeightsRef.current = heights;
      itemOffsetsRef.current = offsets;
    }
  }, [configs]);

  // Save configs order to storage when reordered
  const saveConfigsOrder = useCallback(async (newConfigs: ModelConfig[]) => {
    try {
      // Use the new reorderConfigs method to save sort order
      const configIds = newConfigs.map(c => c.id);
      await configManager.reorderConfigs(configIds);
    } catch (error) {
      console.error('保存配置顺序失败:', error);
    }
  }, []);

  // Handle touch start (for mobile long press)
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { 
      x: touch.clientX, 
      y: touch.clientY,
      scrollTop: listContainerRef.current?.scrollTop || 0
    };
    containerScrollTopRef.current = listContainerRef.current?.scrollTop || 0;
    
    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      setDraggedIndex(index);
      setIsDragging(true);
      setDragOffset(0);
      // Vibrate on mobile if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 400); // 400ms long press
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    
    if (!isDragging || draggedIndex === null) {
      // Cancel long press if moved too much before drag started
      if (longPressTimerRef.current && touchStartPosRef.current) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    e.preventDefault();
    
    // Calculate vertical offset from start position
    if (touchStartPosRef.current) {
      const currentScrollTop = listContainerRef.current?.scrollTop || 0;
      const scrollDelta = currentScrollTop - touchStartPosRef.current.scrollTop;
      const newOffset = touch.clientY - touchStartPosRef.current.y + scrollDelta;
      setDragOffset(newOffset);
    }
  }, [isDragging, draggedIndex]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isDragging && draggedIndex !== null) {
      const targetIndex = getTargetIndex(draggedIndex, dragOffset);
      
      if (targetIndex !== draggedIndex) {
        // Calculate new order
        const newConfigs = [...configs];
        const [movedItem] = newConfigs.splice(draggedIndex, 1);
        newConfigs.splice(targetIndex, 0, movedItem);
        
        // Update store
        reorderConfigs(draggedIndex, targetIndex);
        
        // Save the new order to storage
        saveConfigsOrder(newConfigs);
      }
    }

    touchStartPosRef.current = null;
    setDraggedIndex(null);
    setDragOffset(0);
    setIsDragging(false);
  }, [isDragging, draggedIndex, dragOffset, getTargetIndex, configs, reorderConfigs, saveConfigsOrder]);

  // Calculate transform for each item during drag
  const getItemTransform = useCallback((index: number): string => {
    if (!isDragging || draggedIndex === null) return 'translateY(0)';
    
    if (index === draggedIndex) {
      // The dragged item follows the finger
      return `translateY(${dragOffset}px)`;
    }
    
    const targetIndex = getTargetIndex(draggedIndex, dragOffset);
    const itemHeight = (itemHeightsRef.current[draggedIndex] || 80) + 12; // Include gap
    
    // Items between original and target position need to shift
    if (draggedIndex < targetIndex) {
      // Dragging down: items between original and target shift up
      if (index > draggedIndex && index <= targetIndex) {
        return `translateY(-${itemHeight}px)`;
      }
    } else if (draggedIndex > targetIndex) {
      // Dragging up: items between target and original shift down
      if (index >= targetIndex && index < draggedIndex) {
        return `translateY(${itemHeight}px)`;
      }
    }
    
    return 'translateY(0)';
  }, [isDragging, draggedIndex, dragOffset, getTargetIndex]);

  // Handle create config
  const handleCreate = async (data: CreateConfigInput) => {
    try {
      setIsSaving(true);
      const newConfig = await configManager.createConfig(data);
      addConfig(newConfig);
      
      if (data.isDefault) {
        configs.forEach(c => {
          if (c.isDefault) {
            updateConfig(c.id, { isDefault: false });
          }
        });
      }
      
      setViewMode('list');
    } catch (error) {
      console.error('创建配置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle update config
  const handleUpdate = async (data: CreateConfigInput) => {
    if (!editingConfig) return;
    
    try {
      setIsSaving(true);
      await configManager.updateConfig(editingConfig.id, data);
      updateConfig(editingConfig.id, data);
      
      if (data.isDefault) {
        setDefault(editingConfig.id);
        for (const c of configs) {
          if (c.id !== editingConfig.id && c.isDefault) {
            await configManager.updateConfig(c.id, { isDefault: false });
          }
        }
      }
      
      setViewMode('list');
      setEditingConfig(null);
    } catch (error) {
      console.error('更新配置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete config
  const handleDelete = async (config: ModelConfig) => {
    try {
      await configManager.deleteConfig(config.id);
      removeConfig(config.id);
      setDeleteConfigState(null);
    } catch (error) {
      console.error('删除配置失败:', error);
    }
  };

  // Handle set default
  const handleSetDefault = async (id: string) => {
    try {
      for (const c of configs) {
        await configManager.updateConfig(c.id, { isDefault: c.id === id });
      }
      setDefault(id);
    } catch (error) {
      console.error('设置默认配置失败:', error);
    }
  };

  // Handle test config
  const handleTest = async (config: ModelConfig) => {
    setTestingId(config.id);
    setTestResult(null);
    
    try {
      const result = await configManager.testConfig(config);
      setTestResult({
        id: config.id,
        success: result.success,
        message: result.success ? '连接成功！' : result.message,
      });
    } catch (error) {
      setTestResult({
        id: config.id,
        success: false,
        message: error instanceof Error ? error.message : '测试失败',
      });
    } finally {
      setTestingId(null);
    }
  };

  // Handle edit click
  const handleEditClick = (config: ModelConfig) => {
    setEditingConfig(config);
    setViewMode('edit');
  };

  // Handle cancel
  const handleCancel = () => {
    setViewMode('list');
    setEditingConfig(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          加载中...
        </div>
      </div>
    );
  }

  // Create/Edit form view
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="h-full flex flex-col">
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {viewMode === 'create' ? '添加配置' : '编辑配置'}
          </h2>
        </div>
        <div ref={formContainerRef} className="flex-1 overflow-y-auto p-4">
          <div className="max-w-lg">
            <ConfigForm
              config={editingConfig ?? undefined}
              onSubmit={viewMode === 'create' ? handleCreate : handleUpdate}
              onCancel={handleCancel}
              isLoading={isSaving}
            />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="h-full flex flex-col">
      {/* Header - fixed height with proper alignment */}
      <div className={`flex-shrink-0 p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={handleBack}
              className={`flex-shrink-0 p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
              title="返回"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>模型配置</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                管理你的 AI 模型配置
                {configs.length > 1 && <span className="ml-1">· 长按拖动排序</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => setViewMode('create')}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加配置
          </button>
        </div>
      </div>

      <div 
        ref={listContainerRef} 
        className="flex-1 overflow-y-auto p-4"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: isDragging ? 'none' : 'auto' }}
      >
        {configs.length === 0 ? (
          <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'} py-12`}>
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg mb-2">暂无配置</p>
            <p className="text-sm">点击上方按钮添加你的第一个 AI 配置</p>
          </div>
        ) : (
          <div ref={itemsContainerRef} className="space-y-3 relative">
            {configs.map((config, index) => {
              const isBeingDragged = draggedIndex === index;
              
              return (
                <div
                  key={config.id}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  style={{
                    transform: getItemTransform(index),
                    transition: isDragging && !isBeingDragged ? 'transform 0.1s linear' : 'none',
                    zIndex: isBeingDragged ? 100 : 1,
                    position: 'relative',
                  }}
                  className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border overflow-hidden select-none ${
                    isBeingDragged ? 'shadow-2xl scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>{config.name}</h3>
                        {config.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded flex-shrink-0">默认</span>
                        )}
                        {isImageProvider(config.provider) && (
                          <span className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded flex-shrink-0">文生图</span>
                        )}
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1 truncate`}>
                        {PROVIDER_NAMES[config.provider]} · {config.modelName}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 truncate`}>
                        {config.apiUrl}
                      </p>
                      
                      {/* Test result */}
                      {testResult && testResult.id === config.id && (
                        <p className={`text-sm mt-2 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {testResult.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Test button */}
                      <button
                        onClick={() => handleTest(config)}
                        disabled={testingId === config.id}
                        className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500'} transition-colors`}
                        title="测试连接"
                      >
                        {testingId === config.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>

                      {/* Set default button */}
                      {!config.isDefault && (
                        <button
                          onClick={() => handleSetDefault(config.id)}
                          className={`p-2 ${isDark ? 'text-gray-400 hover:text-yellow-400' : 'text-gray-500 hover:text-yellow-500'} transition-colors`}
                          title="设为默认"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}

                      {/* Edit button */}
                      <button
                        onClick={() => handleEditClick(config)}
                        className={`p-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                        title="编辑"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => setDeleteConfigState(config)}
                        className={`p-2 ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'} transition-colors`}
                        title="删除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfig && (
        <DeleteModal
          configName={deleteConfig.name}
          onConfirm={() => handleDelete(deleteConfig)}
          onCancel={() => setDeleteConfigState(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
};
