/**
 * Google Gemini API Adapter
 * 
 * Implements the AIAdapter interface for Google Gemini API.
 * Supports streaming responses.
 * Supports multimodal (vision) with images.
 * 
 * Requirements: 6.3
 */

import type { AIAdapter, Message, ImageAttachment, ImageGenerationParams } from '../../types';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

export class GoogleAdapter implements AIAdapter {
  apiKey: string;
  modelName: string;
  apiUrl: string;

  constructor(apiKey: string, modelName: string, apiUrl: string = 'https://generativelanguage.googleapis.com/v1beta') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.apiUrl = apiUrl;
  }

  /**
   * Convert internal message format to Gemini format
   */
  private formatMessages(message: string, history: Message[], images?: ImageAttachment[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    
    // Add history messages
    for (const msg of history) {
      const parts: GeminiPart[] = [];
      
      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          const base64Data = img.data.split(',')[1] || img.data;
          parts.push({
            inline_data: {
              mime_type: img.mimeType,
              data: base64Data
            }
          });
        }
      }
      parts.push({ text: msg.content });
      
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      });
    }
    
    // Add current message
    const currentParts: GeminiPart[] = [];
    if (images && images.length > 0) {
      for (const img of images) {
        const base64Data = img.data.split(',')[1] || img.data;
        currentParts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: base64Data
          }
        });
      }
    }
    currentParts.push({ text: message });
    contents.push({ role: 'user', parts: currentParts });
    
    return contents;
  }

  /**
   * Send a message and stream the response
   */
  async *sendMessage(
    message: string, 
    history: Message[], 
    images?: ImageAttachment[],
    _imageParams?: ImageGenerationParams  // Not used for chat models
  ): AsyncGenerator<string, void, unknown> {
    const contents = this.formatMessages(message, history, images);
    
    const url = `${this.apiUrl}/models/${this.modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 4096
        }
      })
    }, 15000); // 15秒连接超时

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Gemini API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed) {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as GeminiStreamChunk;
              
              if (json.error) {
                throw new Error(`Gemini error: ${json.error.message}`);
              }
              
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              
              if (text) {
                yield text;
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Gemini error:')) {
                throw e;
              }
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Validate API credentials by making a simple request
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/models?key=${this.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}
