/**
 * Chat Page
 * 
 * Main chat interface with message display and input.
 * Handles message sending and streaming responses.
 * Supports light/dark theme.
 * Supports image generation parameters for text-to-image models.
 * Each session uses its own model configuration.
 * 
 * Requirements: 2.1, 2.2, 2.4
 */
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageList, MessageInput, ImageParamsPanel } from '../components/chat';
import { useChatStore, getCurrentSession } from '../store/chat-store';
import { useConfigStore } from '../store/config-store';
import { useThemeStore } from '../store/theme-store';
import { chatManager } from '../lib/chat';
import { configManager } from '../lib/config';
import type { Message, ImageAttachment, ImageGenerationParams } from '../types';
import { DEFAULT_IMAGE_PARAMS } from '../types';

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [imageParams, setImageParams] = useState<ImageGenerationParams>({ ...DEFAULT_IMAGE_PARAMS });
  
  // Store state
  const {
    currentSessionId,
    setCurrentSession,
    addSession,
    addMessage,
    updateMessage,
    isStreaming,
    setStreaming,
    setSessions,
    setSessionMessages
  } = useChatStore();
  
  const currentSession = useChatStore(getCurrentSession);
  const configs = useConfigStore((state) => state.configs);
  const setConfigs = useConfigStore((state) => state.setConfigs);
  
  // Get the config for current session (each session has its own model)
  const sessionConfig = useMemo(() => {
    if (!currentSession) return undefined;
    return configs.find((c) => c.id === currentSession.configId);
  }, [currentSession, configs]);

  // Check if current session's config is image generation
  const isImageGenerationMode = useMemo(() => {
    return sessionConfig?.provider === 'image-generation';
  }, [sessionConfig]);
  
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Initialize data
  useEffect(() => {
    const initData = async () => {
      try {
        // Load configs
        const loadedConfigs = await configManager.getAllConfigs();
        setConfigs(loadedConfigs);
        
        // Load sessions
        const loadedSessions = await chatManager.getAllSessions();
        setSessions(loadedSessions);
        
        // Set current session if there's one
        if (loadedSessions.length > 0 && !currentSessionId) {
          setCurrentSession(loadedSessions[0].id);
        }
      } catch (error) {
        console.error('初始化失败:', error);
      }
    };
    
    initData();
  }, [setConfigs, setSessions, setCurrentSession, currentSessionId]);

  // Reload configs when navigating back to this page (to sync config changes from settings)
  useEffect(() => {
    const reloadConfigs = async () => {
      try {
        const loadedConfigs = await configManager.getAllConfigs();
        setConfigs(loadedConfigs);
      } catch (error) {
        console.error('重新加载配置失败:', error);
      }
    };
    
    // Reload when location changes to this page
    if (location.pathname === '/') {
      reloadConfigs();
    }
  }, [location.pathname, setConfigs]);

  // Set up chat manager callbacks
  useEffect(() => {
    chatManager.setCallbacks({
      onStreamStart: (_sessionId, messageId) => {
        setStreamingMessageId(messageId);
        setStreaming(true);
      },
      onStreamChunk: (sessionId, messageId, _chunk, fullContent) => {
        updateMessage(sessionId, messageId, { content: fullContent });
      },
      onStreamEnd: (sessionId, messageId, fullContent) => {
        updateMessage(sessionId, messageId, { content: fullContent, isStreaming: false });
        setStreamingMessageId(null);
        setStreaming(false);
      },
      onStreamError: (sessionId, messageId, error) => {
        updateMessage(sessionId, messageId, { content: `[错误] ${error}`, isStreaming: false });
        setStreamingMessageId(null);
        setStreaming(false);
      }
    });
  }, [updateMessage, setStreaming]);

  // Handle stop streaming
  const handleStopStreaming = useCallback(async () => {
    if (currentSessionId && streamingMessageId) {
      chatManager.cancelStream(currentSessionId);
      // 更新消息显示已终止
      const session = await chatManager.getSession(currentSessionId);
      if (session) {
        const message = session.messages.find(m => m.id === streamingMessageId);
        if (message) {
          const content = message.content ? message.content + '\n\n[已终止]' : '[已终止]';
          updateMessage(currentSessionId, streamingMessageId, { content, isStreaming: false });
        }
      }
      setStreamingMessageId(null);
      setStreaming(false);
    }
  }, [currentSessionId, streamingMessageId, updateMessage, setStreaming]);

  // Handle sending message
  const handleSendMessage = useCallback(async (content: string, images?: ImageAttachment[]) => {
    // Check if we have any config
    if (configs.length === 0) {
      navigate('/settings');
      return;
    }

    try {
      // Create session if needed
      let sessionId = currentSessionId;
      if (!sessionId) {
        // Create new session with default config
        const session = await chatManager.createSession();
        addSession(session);
        setCurrentSession(session.id);
        sessionId = session.id;
      }

      // Get the session's config to check if it's image generation mode
      const session = await chatManager.getSession(sessionId);
      const config = session ? configs.find(c => c.id === session.configId) : undefined;
      const isImageMode = config?.provider === 'image-generation';

      // Send message with images and image params (for image generation mode)
      const userMessage = await chatManager.sendMessage(
        sessionId, 
        content, 
        images,
        isImageMode ? imageParams : undefined
      );
      
      // Add user message to store
      addMessage(sessionId, userMessage);
      
      // Add placeholder for assistant message
      const updatedSession = await chatManager.getSession(sessionId);
      if (updatedSession) {
        const assistantMessage = updatedSession.messages[updatedSession.messages.length - 1];
        if (assistantMessage && assistantMessage.role === 'assistant') {
          addMessage(sessionId, assistantMessage);
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  }, [currentSessionId, configs, navigate, addSession, setCurrentSession, addMessage, imageParams]);

  // Handle resend message
  const handleResendMessage = useCallback(async (messageId: string) => {
    if (!currentSessionId || isStreaming) return;

    try {
      const result = await chatManager.resendMessage(currentSessionId, messageId);
      
      // Update store with new messages list
      setSessionMessages(currentSessionId, result.messages);
      setStreamingMessageId(result.assistantMessageId);
      setStreaming(true);
    } catch (error) {
      console.error('重新发送失败:', error);
    }
  }, [currentSessionId, isStreaming, setSessionMessages, setStreaming]);

  // Get messages for current session
  const messages: Message[] = currentSession?.messages ?? [];

  // Show welcome screen if no config
  if (configs.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <svg className="w-20 h-20 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 className={`text-xl font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>欢迎使用 Maotai AI</h2>
        <p className="mb-4">请先添加一个 AI 配置以开始使用</p>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          前往设置
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Image generation parameters panel - only show for image-generation provider */}
      {isImageGenerationMode && (
        <ImageParamsPanel
          params={imageParams}
          onChange={setImageParams}
          collapsed={true}
        />
      )}
      
      <MessageList 
        messages={messages} 
        streamingMessageId={streamingMessageId ?? undefined}
        onResend={handleResendMessage}
      />
      <MessageInput 
        onSend={handleSendMessage} 
        disabled={isStreaming}
        placeholder={
          isImageGenerationMode 
            ? '描述你想生成的图片...'
            : sessionConfig 
              ? '输入消息...' 
              : '选择模型开始聊天'
        }
        isStreaming={isStreaming}
        onStop={handleStopStreaming}
        hideImageUpload={isImageGenerationMode}
      />
    </div>
  );
};
