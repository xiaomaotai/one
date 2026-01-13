/**
 * Sidebar Component
 * 
 * Navigation sidebar with new chat button, chat history, and settings link.
 * Supports session title editing with 10 character limit.
 * Supports session deletion with confirmation.
 * Works as a drawer on mobile.
 * Supports light/dark theme.
 * Sessions are sorted by updatedAt in descending order (newest first).
 * 
 * Requirements: 8.1, 8.2
 */
import React, { useEffect, useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chat-store';
import { useConfigStore, getDefaultConfig } from '../../store/config-store';
import { useThemeStore } from '../../store/theme-store';
import { chatManager } from '../../lib/chat';
import { configManager } from '../../lib/config';
import { formatRelativeTime } from '../../lib/utils/date';

// Truncate title to max length with ellipsis
const truncateTitle = (title: string, maxLength: number = 10): string => {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength) + '...';
};

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  
  const { sessions, currentSessionId, setCurrentSession, setSessions, addSession, deleteSession } = useChatStore();
  const { configs, setConfigs } = useConfigStore();
  const defaultConfig = useConfigStore(getDefaultConfig);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Sort sessions by updatedAt in descending order (newest first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions]);

  // Check if any session is being edited or deleted
  const isAnyOperationInProgress = editingSessionId !== null || deleteConfirmId !== null;

  // Load sessions and configs on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedSessions, loadedConfigs] = await Promise.all([
          chatManager.getAllSessions(),
          configManager.getAllConfigs()
        ]);
        setSessions(loadedSessions);
        setConfigs(loadedConfigs);
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };
    loadData();
  }, [setSessions, setConfigs]);

  // Reset editing/delete states when drawer closes
  const resetEditingStates = () => {
    setEditingSessionId(null);
    setEditTitle('');
    setDeleteConfirmId(null);
  };

  // Wrap onClose to reset states before closing
  const handleClose = () => {
    resetEditingStates();
    onClose?.();
  };

  // Show toast message
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  // Create new chat
  const handleNewChat = async () => {
    // Check if the latest session (first in sorted list) is empty
    const latestSession = sortedSessions.length > 0 ? sortedSessions[0] : null;
    if (latestSession && latestSession.messages.length === 0) {
      // Switch to the empty session instead of creating a new one
      setCurrentSession(latestSession.id);
      showToast('已有空白会话');
      navigate('/');
      handleClose();
      return;
    }
    
    try {
      if (!defaultConfig && configs.length === 0) {
        navigate('/settings');
        handleClose();
        return;
      }
      const session = await chatManager.createSession();
      addSession(session);
      setCurrentSession(session.id);
      navigate('/');
      handleClose();
    } catch (error) {
      console.error('创建会话失败:', error);
    }
  };

  // Select a session
  const handleSelectSession = (sessionId: string) => {
    if (isAnyOperationInProgress) return; // Don't select when editing or confirming delete
    setCurrentSession(sessionId);
    navigate('/');
    handleClose();
  };

  // Start editing session title
  const handleStartEdit = (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle.slice(0, 10));
  };

  // Save edited title (without reordering)
  const handleSaveTitle = async (sessionId: string) => {
    const trimmedTitle = editTitle.trim().slice(0, 10);
    if (trimmedTitle) {
      try {
        await chatManager.updateSessionTitle(sessionId, trimmedTitle);
        // Update only the title, keep the same position in the list
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          const updatedSessions = [...sessions];
          updatedSessions[sessionIndex] = { ...updatedSessions[sessionIndex], title: trimmedTitle };
          setSessions(updatedSessions);
        }
      } catch (error) {
        console.error('更新标题失败:', error);
      }
    }
    setEditingSessionId(null);
    setEditTitle('');
  };

  // Handle key press in edit input
  const handleEditKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle(sessionId);
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
      setEditTitle('');
    }
  };

  // Handle delete click
  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(sessionId);
  };

  // Confirm delete
  const handleConfirmDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await chatManager.deleteSession(sessionId);
      deleteSession(sessionId);
      // If deleted current session, select another one
      if (currentSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setCurrentSession(remainingSessions[0].id);
        } else {
          setCurrentSession(null);
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
    setDeleteConfirmId(null);
  };

  // Cancel delete
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  return (
    <aside className={`w-full ${isDark ? 'bg-gray-900' : 'bg-white'} flex flex-col h-full relative`}>
      {/* Toast */}
      {toast && (
        <div className={`absolute top-16 left-1/2 transform -translate-x-1/2 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-800 text-white'} px-4 py-2 rounded-lg shadow-lg z-50 text-sm`}>
          {toast}
        </div>
      )}
      
      {/* Header with close button */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
        <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maotai AI</h1>
        {onClose && (
          <button
            onClick={handleClose}
            className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
            aria-label="关闭菜单"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建对话
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-2`}>
            历史对话
          </h2>
          {sortedSessions.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'} px-2`}>暂无对话记录</p>
          ) : (
            <ul className="space-y-1">
              {sortedSessions.map((session) => (
                <li key={session.id}>
                  <div
                    onClick={() => handleSelectSession(session.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors group cursor-pointer ${
                      currentSessionId === session.id
                        ? isDark ? 'bg-gray-700 text-white' : 'bg-blue-50 text-blue-700'
                        : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      /* 编辑模式 */
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value.slice(0, 10))}
                            onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            maxLength={10}
                            className={`flex-1 ${isDark ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 border border-gray-300'} text-sm px-2 py-1 rounded outline-none`}
                            placeholder="最多10个字"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSaveTitle(session.id); }}
                            className="flex-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            保存
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); setEditTitle(''); }}
                            className={`flex-1 px-3 py-1 text-xs ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded transition-colors`}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : deleteConfirmId === session.id ? (
                      /* 删除确认模式 */
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-medium flex-1" title={session.title}>
                            {truncateTitle(session.title)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => handleConfirmDelete(e, session.id)}
                            className="flex-1 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          >
                            确认删除
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            className={`flex-1 px-3 py-1 text-xs ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded transition-colors`}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm font-medium flex-1" title={session.title}>
                              {truncateTitle(session.title)}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={(e) => handleStartEdit(e, session.id, session.title)}
                                disabled={isAnyOperationInProgress}
                                className={`p-1.5 ${isAnyOperationInProgress ? 'opacity-30 cursor-not-allowed' : ''} ${isDark ? 'text-gray-400 hover:text-white active:text-white' : 'text-gray-400 hover:text-gray-700 active:text-gray-700'}`}
                                title="编辑名称"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, session.id)}
                                disabled={isAnyOperationInProgress}
                                className={`p-1.5 ${isAnyOperationInProgress ? 'opacity-30 cursor-not-allowed' : ''} ${isDark ? 'text-gray-400 hover:text-red-400 active:text-red-400' : 'text-gray-400 hover:text-red-500 active:text-red-500'}`}
                                title="删除对话"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    {!editingSessionId && deleteConfirmId !== session.id && (
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
                        {formatRelativeTime(session.updatedAt)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Navigation - Only Settings */}
      <div className={`p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <NavLink
          to="/settings"
          state={{ fromDrawer: true }}
          onClick={handleClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive 
                ? isDark ? 'bg-gray-700 text-white' : 'bg-blue-50 text-blue-700'
                : isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          设置
        </NavLink>
      </div>
    </aside>
  );
};
