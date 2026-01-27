/**
 * Message Input Component
 * 
 * Text input field with send button for composing messages.
 * Supports image upload for multimodal AI models.
 * Hides image upload for text-to-image models.
 * Supports light/dark theme.
 * Handles photo library permissions on native platforms.
 * 
 * Requirements: 2.1
 */
import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { ImageAttachment } from '../../types';
import { useThemeStore } from '../../store/theme-store';

interface MessageInputProps {
  onSend: (content: string, images?: ImageAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isStreaming?: boolean;
  onStop?: () => void;
  hideImageUpload?: boolean;  // Hide image upload for text-to-image models
}

// Check if running in native app - use multiple detection methods
const getPlatform = () => Capacitor.getPlatform();
const isNativeApp = getPlatform() === 'android' || getPlatform() === 'ios';

// Generate unique ID
const generateId = (): string => {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Compress image from data URL
const compressImageFromDataUrl = async (dataUrl: string, maxSizeKB: number = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Set crossOrigin to handle potential CORS issues
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if too large
        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Fill with white background first (for transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels
        let quality = 0.9;
        let result = canvas.toDataURL('image/jpeg', quality);

        while (result.length > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => {
      console.error('Image load error:', e);
      // If image fails to load, return original dataUrl
      resolve(dataUrl);
    };

    // For data URLs, we need to handle them specially
    // Remove crossOrigin for data URLs as it can cause issues
    if (dataUrl.startsWith('data:')) {
      img.crossOrigin = '';
    }

    img.src = dataUrl;
  });
};

// Compress image if needed (for File objects)
const compressImage = async (file: File, maxSizeKB: number = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        const compressed = await compressImageFromDataUrl(dataUrl, maxSizeKB);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled = false,
  placeholder = '输入消息...',
  isStreaming = false,
  onStop,
  hideImageUpload = false
}) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  // Auto-resize textarea based on content, but only when there's actual content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset to minimum height first
      textarea.style.height = '36px';
      // Only expand if there's content
      if (content.trim()) {
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }
  }, [content]);

  // Don't auto-focus on mobile to prevent keyboard from popping up unexpectedly
  // Users can tap the input to focus when they want to type

  const handleSubmit = () => {
    const trimmed = content.trim();
    if ((trimmed || images.length > 0) && !disabled) {
      onSend(trimmed, images.length > 0 ? images : undefined);
      setContent('');
      setImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = '36px';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle image selection - different for native vs web
  const handleImageClick = async () => {
    const platform = getPlatform();
    console.log('Platform detected:', platform, 'isNativeApp:', isNativeApp);
    
    if (platform === 'android' || platform === 'ios') {
      // Native app - use Capacitor Camera plugin with proper permission flow
      console.log('Using Capacitor Camera for native platform');
      try {
        // Use getPhoto with Prompt to let user choose camera or gallery
        // This will automatically request permissions when needed
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt, // Let user choose camera or gallery
          promptLabelHeader: '选择图片来源',
          promptLabelPhoto: '相册',
          promptLabelPicture: '拍照',
          promptLabelCancel: '取消',
        });
        
        console.log('getPhoto result:', photo.format);
        
        if (photo.dataUrl) {
          const compressed = await compressImageFromDataUrl(photo.dataUrl);
          
          setImages(prev => [...prev, {
            id: generateId(),
            data: compressed,
            mimeType: photo.format ? `image/${photo.format}` : 'image/jpeg',
            name: `photo_${Date.now()}.jpg`
          }].slice(0, 4));
        }
      } catch (error: unknown) {
        // User cancelled or error
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('Camera error:', errorMessage);
        
        // Check if it's a permission error
        if (errorMessage.includes('permission') || 
            errorMessage.includes('denied') ||
            errorMessage.includes('access')) {
          setPermissionDenied(true);
        } else if (!errorMessage.includes('cancel') && 
                   !errorMessage.includes('User cancelled') &&
                   !errorMessage.includes('No image picked')) {
          console.error('选择图片失败:', error);
        }
      }
    } else {
      // Web - use file input
      console.log('Using file input for web platform');
      fileInputRef.current?.click();
    }
  };

  // Close permission denied modal
  const handleClosePermissionModal = () => {
    setPermissionDenied(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageAttachment[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      
      try {
        const dataUrl = await compressImage(file);
        newImages.push({
          id: generateId(),
          data: dataUrl,
          mimeType: file.type,
          name: file.name
        });
      } catch (error) {
        console.error('图片处理失败:', error);
      }
    }

    setImages(prev => [...prev, ...newImages].slice(0, 4)); // Max 4 images
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handlePreviewImage = (imageData: string) => {
    setPreviewImage(imageData);
  };

  // Show image upload button only if not hidden
  const showImageUpload = !hideImageUpload;

  return (
    <div className={`border-t ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'} p-4`}>
      <div className="max-w-3xl mx-auto">
        {/* Image Preview */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap" role="list" aria-label="已选择的图片">
            {images.map((img) => (
              <div key={img.id} className="relative" role="listitem">
                <img
                  src={img.data}
                  alt={img.name || '上传的图片'}
                  className={`w-16 h-16 object-cover rounded-lg border ${isDark ? 'border-gray-600' : 'border-gray-300'} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => handlePreviewImage(img.data)}
                />
                <button
                  onClick={(e) => handleRemoveImage(e, img.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow-lg"
                  aria-label={`移除图片 ${img.name || '上传的图片'}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`flex items-end gap-3 ${isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'} rounded-xl p-2`} role="group" aria-label="消息输入区域">
          {/* Image Upload Button - only show if not hidden */}
          {showImageUpload && (
            <>
              <button
                onClick={handleImageClick}
                disabled={disabled || images.length >= 4}
                className={`p-2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                aria-label={images.length >= 4 ? '已达到最大图片数量' : '上传图片（最多4张）'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
              />
            </>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="输入消息"
            className={`flex-1 bg-transparent ${isDark ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'} resize-none px-2 py-1.5 focus:outline-none disabled:opacity-50 overflow-hidden`}
            style={{
              height: '36px',
              minHeight: '36px',
              maxHeight: '200px',
              whiteSpace: content.trim() ? 'pre-wrap' : 'nowrap',
              textOverflow: 'ellipsis'
            }}
          />
          {isStreaming && onStop ? (
            <button
              onClick={onStop}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              aria-label="停止生成"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={disabled || (!content.trim() && images.length === 0)}
              className={`p-2 bg-blue-600 hover:bg-blue-700 ${isDark ? 'disabled:bg-gray-600' : 'disabled:bg-gray-300'} disabled:cursor-not-allowed text-white rounded-lg transition-colors`}
              aria-label={disabled ? '发送中' : '发送消息'}
            >
              {disabled ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          )}
        </div>
        {/* Only show hint on web, not in native app */}
        {!isNativeApp && (
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-2 text-center`}>
            按 Enter 发送，Shift + Enter 换行{showImageUpload ? '，支持上传图片' : ''}
          </p>
        )}
      </div>

      {/* Full screen image preview modal - click anywhere to close */}
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
            className="max-w-full max-h-full object-contain rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Permission denied modal */}
      {permissionDenied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-5 max-w-sm w-full shadow-xl border`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>需要相册权限</h3>
            </div>
            <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm mb-5`}>
              请在系统设置中允许访问相册，以便选择图片发送。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClosePermissionModal}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
