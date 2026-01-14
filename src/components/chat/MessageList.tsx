/**
 * Message List Component
 *
 * Displays all messages in a chat session with auto-scroll.
 * Supports light/dark theme.
 * Preserves scroll position when app is backgrounded/resumed.
 * Uses flex-direction: column-reverse to naturally start at bottom (no flash).
 *
 * Requirements: 2.3, 2.4
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useThemeStore } from '../../store/theme-store';
import { useChatStore } from '../../store/chat-store';

interface MessageListProps {
  messages: Message[];
  streamingMessageId?: string;
  onResend?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, streamingMessageId, onResend }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const savedScrollPositionRef = useRef<number | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';
  
  // Get current session ID to detect session changes
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const lastSessionIdRef = useRef<string | null>(null);

  // Check if scroll is at bottom (for column-reverse, scrollTop 0 means at bottom)
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      // In column-reverse, scrollTop = 0 means we're at the bottom (newest messages)
      // scrollTop becomes negative as we scroll up to older messages
      const threshold = 50;
      const atBottom = Math.abs(container.scrollTop) < threshold;
      setIsAtBottom(atBottom);
    }
  }, []);

  // Scroll to bottom (in column-reverse, this means scrollTop = 0)
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  // Detect session change and scroll to bottom
  useEffect(() => {
    if (currentSessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = currentSessionId;
      // Reset scroll position for new session
      savedScrollPositionRef.current = null;
      // Scroll to bottom for new session
      scrollToBottom();
    }
  }, [currentSessionId, scrollToBottom]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let stateChangeListener: { remove: () => void } | null = null;

    const setupAppStateListener = async () => {
      try {
        stateChangeListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            // App going to background - save scroll position
            if (containerRef.current) {
              savedScrollPositionRef.current = containerRef.current.scrollTop;
            }
          } else {
            // App coming to foreground - restore scroll position
            if (containerRef.current && savedScrollPositionRef.current !== null) {
              const savedPosition = savedScrollPositionRef.current;
              requestAnimationFrame(() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = savedPosition;
                }
              });
            }
          }
        });
      } catch (error) {
        console.error('App state listener setup failed:', error);
      }
    };

    setupAppStateListener();

    return () => {
      stateChangeListener?.remove();
    };
  }, []);

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
            setTimeout(scrollToBottom, 50);
          }
        });

        // When keyboard hides, scroll to bottom if we were at bottom
        keyboardHideListener = await Keyboard.addListener('keyboardWillHide', () => {
          if (isAtBottom) {
            setTimeout(scrollToBottom, 50);
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

  // Auto-scroll to bottom when new messages are added (if already at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages.length, isAtBottom, scrollToBottom]);

  // Also scroll when any message content changes (for streaming)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages.map(m => m.content).join(''), isAtBottom, scrollToBottom]);

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

  // Use flex-direction: column-reverse so content naturally starts at bottom
  // Messages are reversed in the array so they display in correct order
  const reversedMessages = [...messages].reverse();

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 flex flex-col-reverse"
      onScroll={checkIfAtBottom}
    >
      <div className="max-w-3xl mx-auto w-full space-y-3 flex flex-col-reverse">
        {reversedMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={message.id === streamingMessageId}
            onResend={onResend}
          />
        ))}
      </div>
    </div>
  );
};
