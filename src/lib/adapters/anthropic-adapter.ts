/**
 * Anthropic API Adapter
 * 
 * Implements the AIAdapter interface for Anthropic API (Claude).
 * Supports streaming responses using Server-Sent Events.
 * Supports multimodal (vision) with images.
 * 
 * Requirements: 6.2
 */

import type { AIAdapter, Message, ImageAttachment } from '../../types';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

interface AnthropicContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
  };
  message?: {
    id: string;
    type: string;
    role: string;
    content: Array<{ type: string; text: string }>;
  };
}

export class AnthropicAdapter implements AIAdapter {
  apiKey: string;
  modelName: string;
  apiUrl: string;

  constructor(apiKey: string, modelName: string, apiUrl: string = 'https://api.anthropic.com') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.apiUrl = apiUrl;
  }

  /**
   * Convert internal message format to Anthropic format
   */
  private formatMessages(message: string, history: Message[], images?: ImageAttachment[]): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];
    
    // Add history messages
    for (const msg of history) {
      if (msg.images && msg.images.length > 0) {
        const content: AnthropicContentBlock[] = [];
        for (const img of msg.images) {
          // Extract base64 data from data URL
          const base64Data = img.data.split(',')[1] || img.data;
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mimeType,
              data: base64Data
            }
          });
        }
        content.push({ type: 'text', text: msg.content });
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
      const content: AnthropicContentBlock[] = [];
      for (const img of images) {
        const base64Data = img.data.split(',')[1] || img.data;
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mimeType,
            data: base64Data
          }
        });
      }
      content.push({ type: 'text', text: message });
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
    
    const response = await fetchWithTimeout(`${this.apiUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        max_tokens: 4096,
        stream: true
      })
    }, 15000); // 15秒连接超时

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
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
          
          if (!trimmed || trimmed.startsWith('event:')) {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6)) as AnthropicStreamEvent;
              
              if (json.type === 'content_block_delta' && json.delta?.text) {
                yield json.delta.text;
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
      // Anthropic doesn't have a simple validation endpoint,
      // so we make a minimal request
      const response = await fetch(`${this.apiUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1
        })
      });
      
      // 200 or 400 (bad request but valid auth) means credentials are valid
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  }
}
