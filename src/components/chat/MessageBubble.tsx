/**
 * Message Bubble Component
 * 
 * Displays a single chat message with different styling for user/assistant.
 * Supports streaming animation for assistant messages.
 * Includes copy and resend actions.
 * Supports light/dark theme.
 * Supports code block formatting with copy button.
 * Supports generated image display from text-to-image models with download button.
 * 
 * Requirements: 2.3, 2.4
 */
import React, { useState, useEffect } from 'react';
import type { Message } from '../../types';
import { formatTime } from '../../lib/utils/date';
import { useThemeStore } from '../../store/theme-store';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onResend?: (messageId: string) => void;
}

// Toast component for showing brief messages
const Toast: React.FC<{ message: string; show: boolean; type: 'success' | 'error' }> = ({ message, show, type }) => {
  if (!show) return null;
  
  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in">
      <div className={`px-4 py-2 rounded-full shadow-lg ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white text-sm font-medium`}>
        {message}
      </div>
    </div>
  );
};

// Cross-platform copy to clipboard function
const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.log('Clipboard API failed, trying fallback:', e);
    }
  }
  
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'top:0;left:0;position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (e) {
    console.error('Fallback copy failed:', e);
    return false;
  }
};

// Download image function - works on both web and native
const downloadImage = async (imageUrl: string, filename?: string): Promise<{ success: boolean; message: string }> => {
  const finalFilename = filename || `image_${Date.now()}.png`;
  
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.includes(',') ? result.split(',')[1] : result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        await Filesystem.writeFile({
          path: `MaotaiAI/${finalFilename}`,
          data: base64,
          directory: Directory.Documents,
          recursive: true
        });
        
        return { success: true, message: '保存成功' };
      } catch (err) {
        console.error('Native save failed:', err);
        return { success: false, message: '保存失败' };
      }
    } else {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return { success: true, message: '下载成功' };
      } catch {
        window.open(imageUrl, '_blank');
        return { success: true, message: '已打开图片' };
      }
    }
  } catch (error) {
    console.error('Download failed:', error);
    return { success: false, message: '下载失败' };
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
const CodeBlock: React.FC<{ code: string; language?: string; isDark: boolean }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await copyToClipboard(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="code-block-container relative my-2 rounded-lg bg-gray-900" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <div className="flex items-center justify-between px-2.5 py-1 bg-gray-800 text-[11px]">
        <span className="text-gray-400">{language || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-gray-400 active:text-white transition-colors flex-shrink-0">
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
      <div className="code-scroll-area" style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
        <pre className="p-2.5 text-[13px] leading-relaxed" style={{ margin: 0, background: 'transparent' }}>
          <code className="text-gray-100" style={{ whiteSpace: 'pre', display: 'block', width: 'fit-content', minWidth: '100%' }}>{code}</code>
        </pre>
      </div>
    </div>
  );
};

// Generated image component with download button below the image, aligned to right
const GeneratedImage: React.FC<{ 
  url: string; 
  alt: string; 
  isDark: boolean; 
  onImageClick: (url: string) => void; 
  onToast: (message: string, type: 'success' | 'error') => void 
}> = ({ url, alt, isDark, onImageClick, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    const result = await downloadImage(url);
    onToast(result.message, result.success ? 'success' : 'error');
    setDownloading(false);
  };

  return (
    <div className="my-2 inline-flex flex-col">
      {/* Image container */}
      <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
        {loading && !error && (
          <div className="flex items-center justify-center p-8">
            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
        {error && (
          <div className={`flex items-center justify-center p-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">图片加载失败</p>
            </div>
          </div>
        )}
        <img 
          src={url} 
          alt={alt} 
          className={`max-w-full rounded-lg cursor-pointer active:opacity-80 ${loading ? 'hidden' : 'block'}`} 
          style={{ maxHeight: '400px', objectFit: 'contain' }} 
          onLoad={() => setLoading(false)} 
          onError={() => { setLoading(false); setError(true); }} 
          onClick={() => onImageClick(url)} 
        />
      </div>
      
      {/* Download button below the image, aligned to right */}
      {!loading && !error && (
        <div className="flex justify-end mt-1.5">
          <button 
            onClick={handleDownload} 
            disabled={downloading} 
            className={`p-1.5 rounded-lg transition-all ${downloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'} text-white shadow-sm`}
            title="保存图片"
          >
            {downloading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// Check if message contains generated images (markdown image syntax)
const containsGeneratedImage = (content: string): boolean => /!\[([^\]]*)\]\(([^)]+)\)/.test(content);

// Parse message content and render code blocks and images
const renderMessageContent = (
  content: string, 
  isDark: boolean, 
  onImageClick: (url: string) => void, 
  onToast: (message: string, type: 'success' | 'error') => void
) => {
  const combinedRegex = /```(\w*)\n([\s\S]*?)```|!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++} className="whitespace-pre-wrap break-words">{content.slice(lastIndex, match.index)}</span>);
    }
    if (match[0].startsWith('```')) {
      parts.push(<CodeBlock key={key++} code={match[2].trim()} language={match[1] || ''} isDark={isDark} />);
    } else if (match[0].startsWith('![')) {
      parts.push(<GeneratedImage key={key++} url={match[4]} alt={match[3] || '生成的图片'} isDark={isDark} onImageClick={onImageClick} onToast={onToast} />);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={key++} className="whitespace-pre-wrap break-words">{content.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : <span className="whitespace-pre-wrap break-words">{content}</span>;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming, onResend }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';
  const hasGeneratedImage = message.content ? containsGeneratedImage(message.content) : false;
  
  // Check if message is still streaming (either by prop or by message.isStreaming flag)
  const isMessageStreaming = isStreaming || message.isStreaming;
  
  // Check if content is empty or only whitespace
  const hasContent = message.content && message.content.trim().length > 0;

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const handleCopy = async () => {
    if (!message.content) return;
    if (await copyToClipboard(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImageClick = (imageData: string) => setPreviewImage(imageData);
  
  const handleToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
  };

  // Render message content based on state
  const renderContent = () => {
    // Show loading dots only when streaming and no content yet
    if (isMessageStreaming && !hasContent) {
      return <LoadingDots />;
    }
    
    // Show content if available
    if (hasContent) {
      if (isUser) {
        return <span className="whitespace-pre-wrap break-words">{message.content}</span>;
      }
      return renderMessageContent(message.content, isDark, handleImageClick, handleToast);
    }
    
    // Fallback for empty content (shouldn't normally happen)
    return <span className="text-gray-400">（无内容）</span>;
  };

  return (
    <>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'animate-slide-in-right' : 'animate-slide-in-left'}`} style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-blue-400 flex items-center justify-center mr-2 flex-shrink-0 text-white text-[10px] font-bold mt-0.5">
            AI
          </div>
        )}
        
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`} style={{ maxWidth: '85%', minWidth: 0, overflow: 'hidden' }}>
          <div className={`rounded-2xl px-3 py-2.5 ${isUser ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' : isDark ? 'bg-gray-700/90 text-gray-100 rounded-bl-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`} style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
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
            
            <div className={`message-content break-words text-[15px] leading-relaxed w-full ${isUser ? 'user-message-content' : ''}`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word', minWidth: 0, maxWidth: '100%' }}>
              {renderContent()}
              {isMessageStreaming && hasContent && <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />}
            </div>
          </div>
          
          <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatTime(message.timestamp)}</span>
            
            {hasContent && !isMessageStreaming && (
              <div className="flex items-center gap-0.5">
                {!(hasGeneratedImage && !isUser) && (
                  <button onClick={handleCopy} className={`p-1 ${isDark ? 'text-gray-500 active:text-gray-300' : 'text-gray-400 active:text-gray-600'} rounded transition-colors`} title="复制">
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
                )}
                {isUser && onResend && (
                  <button onClick={() => setShowResendModal(true)} className={`p-1 ${isDark ? 'text-gray-500 active:text-gray-300' : 'text-gray-400 active:text-gray-600'} rounded transition-colors`} title="重新发送">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {isUser && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ml-2 flex-shrink-0 text-white text-[10px] font-bold mt-0.5">
            我
          </div>
        )}
      </div>

      {/* Toast notification */}
      <Toast message={toast.message} show={toast.show} type={toast.type} />

      {/* Image Preview Modal - with safe area for status bar */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-pointer"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}
          onClick={() => setPreviewImage(null)}
        >
          <img 
            src={previewImage} 
            alt="预览" 
            className="max-w-[95vw] max-h-[90vh] object-contain"
          />
        </div>
      )}

      {/* Resend Confirmation Modal - with safe area for status bar */}
      {showResendModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowResendModal(false)} />
          <div className={`relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>重新发送</h3>
            <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
              确定要重新发送这条消息吗？这将删除此消息之后的所有对话。
            </p>
            <div className="flex gap-3">
              {/* 取消按钮在左边 */}
              <button
                onClick={() => setShowResendModal(false)}
                className={`flex-1 px-4 py-2 ${isDark ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} ${isDark ? 'text-white' : 'text-gray-700'} rounded-lg transition-colors`}
              >
                取消
              </button>
              {/* 确定按钮在右边 */}
              <button
                onClick={() => {
                  onResend?.(message.id);
                  setShowResendModal(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
