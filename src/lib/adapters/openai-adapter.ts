/**
 * OpenAI API Adapter
 * 
 * Implements the AIAdapter interface for OpenAI API (ChatGPT).
 * Supports streaming responses using Server-Sent Events.
 * Supports multimodal (vision) with images.
 * 
 * Requirements: 6.1
 */

import type { AIAdapter, Message, ImageAttachment } from '../../types';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

interface OpenAIMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIMessageContent[];
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export class OpenAIAdapter implements AIAdapter {
  apiKey: string;
  apiUrl: string;
  modelName: string;

  constructor(apiKey: string, apiUrl: string, modelName: string) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.modelName = modelName;
  }

  /**
   * Convert internal message format to OpenAI format
   */
  private formatMessages(message: string, history: Message[], images?: ImageAttachment[]): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];
    
    // Add history messages
    for (const msg of history) {
      if (msg.images && msg.images.length > 0) {
        // Message with images
        const content: OpenAIMessageContent[] = [
          { type: 'text', text: msg.content }
        ];
        for (const img of msg.images) {
          content.push({
            type: 'image_url',
            image_url: { url: img.data, detail: 'auto' }
          });
        }
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content
        });
      } else {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    
    // Add current message
    if (images && images.length > 0) {
      const content: OpenAIMessageContent[] = [
        { type: 'text', text: message }
      ];
      for (const img of images) {
        content.push({
          type: 'image_url',
          image_url: { url: img.data, detail: 'auto' }
        });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: message });
    }
    
    return messages;
  }

  /**
   * Send a message and stream the response
   */
  async *sendMessage(message: string, history: Message[], images?: ImageAttachment[]): AsyncGenerator<string, void, unknown> {
    const messages = this.formatMessages(message, history, images);
    
    const response = await fetchWithTimeout(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        stream: true
      })
    }, 15000); // 15秒连接超时

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
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
          
          if (!trimmed || trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk;
              const content = json.choices[0]?.delta?.content;
              
              if (content) {
                yield content;
              }
            } catch {
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
      const response = await fetch(`${this.apiUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}
