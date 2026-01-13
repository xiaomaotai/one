/**
 * Message List Component
 * 
 * Displays all messages in a chat session with auto-scroll.
 * Supports light/dark theme.
 * Preserves scroll position when app is backgrounded/resumed.
 * Instantly scrolls to bottom when switching sessions.
 * 
 * Requirements: 2.3, 2.4
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useThemeStore } from '../../store/theme-store';
import { useScrollRestore } from '../../lib/utils/use-scroll-restore';
import { useChatStore } from '../../store/chat-store';

interface MessageListProps {
  messages: Message[];
  streamingMessageId?: string;
  onResend?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, streamingMessageId, onResend }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';
  
  // Get current session ID to detect session changes
  const currentSessionId = useChatStore((state) => state.currentSessionId);

  // Use scroll restore hook
  useScrollRestore(containerRef);

  // Check if scroll is at bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const threshold = 50; // pixels from bottom to consider "at bottom"
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsAtBottom(atBottom);
    }
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    }
  }, []);

  // Detect session change and reset initial load state
  useEffect(() => {
    if (currentSessionId !== lastSessionId) {
      setLastSessionId(currentSessionId);
      setIsInitialLoad(true);
      // Immediately scroll to bottom without animation when session changes
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [currentSessionId, lastSessionId, scrollToBottom]);

  // Handle keyboard events for native app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let keyboardShowListener: { remove: () => void } | null = null;
    let keyboardHideListener: { remove: () => void } | null = null;

    const setupKeyboardListeners = async () => {
      try {
        // When keyboard shows, scroll to bottom if we were at bottom
        keyboardShowListener = await Keyboard.addListener('keyboardWillShow', () => {
          if (isAtBottom) {
            // Small delay to let the keyboard animation start
            setTimeout(() => scrollToBottom(false), 50);
          }
        });

        // When keyboard hides, scroll to bottom if we were at bottom
        keyboardHideListener = await Keyboard.addListener('keyboardWillHide', () => {
          if (isAtBottom) {
            setTimeout(() => scrollToBottom(false), 50);
          }
        });
      } catch (error) {
        console.error('键盘监听设置失败:', error);
      }
    };

    setupKeyboardListeners();

    return () => {
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
    };
  }, [isAtBottom, scrollToBottom]);

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkIfAtBottom);
    return () => container.removeEventListener('scroll', checkIfAtBottom);
  }, [checkIfAtBottom]);

  // Initial scroll to bottom without animation (on first load or session change)
  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      // Use instant scroll for initial load to avoid visible animation
      scrollToBottom(false);
      // Mark initial load as complete after a short delay
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad, messages.length, scrollToBottom]);

  // Auto-scroll to bottom when new messages are added (after initial load)
  useEffect(() => {
    if (!isInitialLoad && isAtBottom) {
      scrollToBottom(true);
    }
  }, [messages.length, isInitialLoad, isAtBottom, scrollToBottom]);

  // Also scroll when any message content changes (for streaming)
  useEffect(() => {
    if (isAtBottom && !isInitialLoad) {
      scrollToBottom(true);
    }
  }, [messages.map(m => m.content).join(''), isAtBottom, isInitialLoad, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg">开始新对话</p>
          <p className="text-sm mt-1">在下方输入消息开始聊天</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3"
      onScroll={checkIfAtBottom}
    >
      <div className="max-w-3xl mx-auto space-y-3">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={message.id === streamingMessageId}
            onResend={onResend}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
