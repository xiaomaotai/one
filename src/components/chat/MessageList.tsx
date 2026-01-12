/**
 * Message List Component
 * 
 * Displays all messages in a chat session with auto-scroll.
 * Supports light/dark theme.
 * 
 * Requirements: 2.3, 2.4
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useThemeStore } from '../../store/theme-store';

interface MessageListProps {
  messages: Message[];
  streamingMessageId?: string;
  onResend?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, streamingMessageId, onResend }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

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

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    scrollToBottom();
  }, [messages, messages.length, scrollToBottom]);

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

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-3 py-3"
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
