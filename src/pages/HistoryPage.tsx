/**
 * History Page
 * 
 * Displays all chat sessions with preview, selection, and deletion.
 * 
 * Requirements: 3.3, 3.4, 3.5, 5.2, 5.3
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../store/chat-store';
import { chatManager } from '../lib/chat';
import type { ChatSession } from '../types';

// Format date for display
const formatDate = (date: Date): string => {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
};

// Get session preview text
const getPreview = (session: ChatSession): string => {
  if (session.messages.length === 0) {
    return '空对话';
  }
  const lastMessage = session.messages[session.messages.length - 1];
  const preview = lastMessage.content.slice(0, 100);
  return preview.length < lastMessage.content.length ? `${preview}...` : preview;
};

// Get session title
const getTitle = (session: ChatSession): string => {
  if (session.title) {
    return session.title;
  }
  if (session.messages.length > 0) {
    const firstUserMsg = session.messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 50);
      return title.length < firstUserMsg.content.length ? `${title}...` : title;
    }
  }
  return '新对话';
};

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { sessions, setSessions, setCurrentSession, deleteSession } = useChatStore();

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true);
        const loadedSessions = await chatManager.getAllSessions();
        setSessions(loadedSessions);
      } catch (error) {
        console.error('加载历史记录失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSessions();
  }, [setSessions]);

  // Handle session click - load and navigate to chat
  const handleSessionClick = (session: ChatSession) => {
    setCurrentSession(session.id);
    navigate('/');
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">
          <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          加载中...
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h2 className="text-lg font-medium text-white mb-2">暂无聊天记录</h2>
        <p className="mb-4">开始一个新对话吧</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          开始聊天
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold">聊天历史</h2>
        <p className="text-sm text-gray-400 mt-1">共 {sessions.length} 个对话</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session)}
              className="p-4 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">
                    {getTitle(session)}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {getPreview(session)}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{formatDate(session.updatedAt)}</span>
                    <span>{session.messages.length} 条消息</span>
                  </div>
                </div>
                
                <div className="ml-4 flex-shrink-0">
                  {deleteConfirmId === session.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleConfirmDelete(e, session.id)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        确认
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(e, session.id)}
                      className="p-2 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="删除对话"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
