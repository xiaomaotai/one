/**
 * Message Bubble Component
 * 
 * Displays a single chat message with different styling for user/assistant.
 * Supports streaming animation for assistant messages.
 * Includes copy and resend actions.
 * Supports light/dark theme.
 * Supports code block formatting with copy button.
 * 
 * Requirements: 2.3, 2.4
 */
import React, { useState } from 'react';
import type { Message } from '../../types';
import { formatTime } from '../../lib/utils/date';
import { useThemeStore } from '../../store/theme-store';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onResend?: (messageId: string) => void;
}

// Cross-platform copy to clipboard function
const copyToClipboard = async (text: string): Promise<boolean> => {
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.log('Clipboard API failed, trying fallback:', e);
    }
  }
  
  // Fallback for Android WebView and older browsers
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // For iOS
    textArea.setSelectionRange(0, text.length);
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (e) {
    console.error('Fallback copy failed:', e);
    return false;
  }
};

// Loading dots animation component
const LoadingDots: React.FC = () => (
  <span className="inline-flex items-center">
    <span className="animate-bounce-dot-1">.</span>
    <span className="animate-bounce-dot-2">.</span>
    <span className="animate-bounce-dot-3">.</span>
  </span>
);

// Code block component with copy button
interface CodeBlockProps {
  code: string;
  language?: string;
  isDark: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, isDark }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`relative my-2 rounded-lg overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-800'}`}>
      {/* Header with language and copy button */}
      <div className={`flex items-center justify-between px-3 py-1.5 ${isDark ? 'bg-gray-800' : 'bg-gray-700'} text-xs`}>
        <span className="text-gray-400">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-3 overflow-x-auto text-sm">
        <code className="text-gray-100 whitespace-pre">{code}</code>
      </pre>
    </div>
  );
};

// Parse message content and render code blocks
const renderMessageContent = (content: string, isDark: boolean) => {
  // Match code blocks: ```language\ncode\n``` or ```\ncode\n```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      parts.push(
        <span key={key++} className="whitespace-pre-wrap break-words">
          {textBefore}
        </span>
      );
    }

    // Add code block
    const language = match[1] || '';
    const code = match[2].trim();
    parts.push(
      <CodeBlock key={key++} code={code} language={language} isDark={isDark} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap break-words">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : <span className="whitespace-pre-wrap break-words">{content}</span>;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming, onResend }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Copy message content to clipboard
  const handleCopy = async () => {
    if (!message.content) return;
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle image preview
  const handleImageClick = (imageData: string) => {
    setPreviewImage(imageData);
  };

  // Handle resend confirmation
  const handleResendClick = () => {
    setShowResendModal(true);
  };

  const handleConfirmResend = () => {
    setShowResendModal(false);
    onResend?.(message.id);
  };

  const handleCancelResend = () => {
    setShowResendModal(false);
  };

  return (
    <>
      <div className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
        {/* Avatar for assistant - using Maotai AI logo style */}
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-blue-400 flex items-center justify-center mr-2 flex-shrink-0 text-white text-xs font-bold self-start">
            AI
          </div>
        )}
        
        <div className="flex flex-col max-w-[75%]">
          <div
            className={`rounded-2xl px-4 py-3 shadow-lg ${
              isUser
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md'
                : isDark 
                  ? 'bg-gray-700/80 text-gray-100 rounded-bl-md border border-gray-600/50'
                  : 'bg-gray-100 text-gray-900 rounded-bl-md border border-gray-200'
            }`}
          >
            {/* Images */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.images.map((img) => (
                  <div key={img.id} className="relative overflow-hidden rounded-lg bg-gray-800">
                    <img
                      src={img.data}
                      alt={img.name || '图片'}
                      className="max-w-[200px] max-h-[200px] rounded-lg object-contain cursor-pointer hover:opacity-90"
                      style={{ display: 'block' }}
                      onClick={() => handleImageClick(img.data)}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Message Content */}
            <div className="message-content break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {isStreaming && !message.content ? (
                <LoadingDots />
              ) : message.content ? (
                isUser ? (
                  <span className="whitespace-pre-wrap break-words">{message.content}</span>
                ) : (
                  renderMessageContent(message.content, isDark)
                )
              ) : (
                '...'
              )}
              {/* Show cursor when streaming and has content */}
              {isStreaming && message.content && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse" />
              )}
            </div>
            
            {/* Timestamp */}
            <div className={`text-xs mt-2 ${isUser ? 'text-blue-200' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatTime(message.timestamp)}
            </div>
          </div>
          
          {/* Action buttons - below the message bubble */}
          {message.content && !isStreaming && (
            <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {/* Copy button */}
              <button
                onClick={handleCopy}
                className={`p-1.5 ${isDark ? 'text-gray-500 hover:text-gray-300 active:text-gray-300' : 'text-gray-400 hover:text-gray-600 active:text-gray-600'} rounded transition-colors`}
                title="复制"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              
              {/* Resend button - only for user messages */}
              {isUser && onResend && (
                <button
                  onClick={handleResendClick}
                  className={`p-1.5 ${isDark ? 'text-gray-500 hover:text-gray-300 active:text-gray-300' : 'text-gray-400 hover:text-gray-600 active:text-gray-600'} rounded transition-colors`}
                  title="重新发送"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Avatar for user */}
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center ml-2 flex-shrink-0 self-start">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Resend confirmation modal */}
      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-5 max-w-sm w-full shadow-xl border`}>
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>重新发送</h3>
            <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm mb-5`}>
              此操作将清除该消息之后的所有对话记录，并重新获取 AI 回复。确定继续吗？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelResend}
                className={`px-4 py-2 ${isDark ? 'text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'} rounded-lg transition-colors`}
              >
                取消
              </button>
              <button
                onClick={handleConfirmResend}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-gray-700 rounded-full transition-colors z-10"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="预览图片"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
};
