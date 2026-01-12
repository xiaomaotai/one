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

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      className="code-block-container relative my-2 rounded-lg bg-gray-900"
      style={{ 
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-gray-800 text-[11px]">
        <span className="text-gray-400">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 active:text-white transition-colors flex-shrink-0"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      {/* Code content - independent horizontal scroll */}
      <div 
        className="code-scroll-area"
        style={{ 
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        <pre 
          className="p-2.5 text-[13px] leading-relaxed"
          style={{ margin: 0, background: 'transparent' }}
        >
          <code 
            className="text-gray-100"
            style={{ 
              whiteSpace: 'pre',
              display: 'block',
              width: 'fit-content',
              minWidth: '100%'
            }}
          >
            {code}
          </code>
        </pre>
      </div>
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
      <div 
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
        style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}
      >
        {/* Avatar for assistant - smaller on mobile */}
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-blue-400 flex items-center justify-center mr-2 flex-shrink-0 text-white text-[10px] font-bold mt-0.5">
            AI
          </div>
        )}
        
        <div 
          className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
          style={{ 
            maxWidth: '85%',
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          <div
            className={`rounded-2xl px-3 py-2.5 ${
              isUser
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm'
                : isDark 
                  ? 'bg-gray-700/90 text-gray-100 rounded-bl-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}
            style={{
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            {/* Images - optimized for mobile */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {message.images.map((img) => (
                  <div key={img.id} className={`relative overflow-hidden rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    <img
                      src={img.data}
                      alt={img.name || '图片'}
                      className="max-w-[150px] max-h-[150px] sm:max-w-[200px] sm:max-h-[200px] rounded-lg object-contain cursor-pointer active:opacity-80"
                      style={{ display: 'block' }}
                      onClick={() => handleImageClick(img.data)}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Message Content - optimized text size */}
            <div 
              className="message-content break-words text-[15px] leading-relaxed w-full" 
              style={{ 
                wordBreak: 'break-word', 
                overflowWrap: 'break-word',
                minWidth: 0,
                maxWidth: '100%'
              }}
            >
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
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
              )}
            </div>
          </div>
          
          {/* Timestamp and actions - outside bubble for cleaner look */}
          <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {formatTime(message.timestamp)}
            </span>
            
            {/* Action buttons */}
            {message.content && !isStreaming && (
              <div className="flex items-center gap-0.5">
                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className={`p-1 ${isDark ? 'text-gray-500 active:text-gray-300' : 'text-gray-400 active:text-gray-600'} rounded transition-colors`}
                  title="复制"
                >
                  {copied ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                
                {/* Resend button - only for user messages */}
                {isUser && onResend && (
                  <button
                    onClick={handleResendClick}
                    className={`p-1 ${isDark ? 'text-gray-500 active:text-gray-300' : 'text-gray-400 active:text-gray-600'} rounded transition-colors`}
                    title="重新发送"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Avatar for user - smaller on mobile */}
        {isUser && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center ml-2 flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
