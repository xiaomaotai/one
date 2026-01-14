/**
 * Chat Manager
 * 
 * Manages chat sessions, message exchange, and streaming responses.
 * Coordinates between storage, API adapters, and configuration.
 * 
 * Requirements: 3.1, 3.2, 3.4, 5.1, 5.2, 2.1, 2.2, 2.4
 */

import type {
  ChatSession,
  Message,
  ModelConfig,
  CreateSessionInput,
  SessionPreview,
  ImageAttachment,
  ImageGenerationParams
} from '../../types';
import { storageManager } from '../storage';
import { configManager } from '../config';
import { createChatSession, createMessage, generateSessionTitle } from '../factories';
import { createAdapter } from '../adapters';

/** Streaming state for a message */
export interface StreamingState {
  sessionId: string;
  messageId: string;
  content: string;
  isComplete: boolean;
  error?: string;
}

/** Chat manager event callbacks */
export interface ChatManagerCallbacks {
  onStreamStart?: (sessionId: string, messageId: string) => void;
  onStreamChunk?: (sessionId: string, messageId: string, chunk: string, fullContent: string) => void;
  onStreamEnd?: (sessionId: string, messageId: string, fullContent: string) => void;
  onStreamError?: (sessionId: string, messageId: string, error: string) => void;
}

// Special marker to indicate content replacement (used by image generation)
const REPLACE_CONTENT_MARKER = '__REPLACE_CONTENT__';

export class ChatManager {
  private callbacks: ChatManagerCallbacks = {};
  private activeStreams: Map<string, AbortController> = new Map();

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: ChatManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Create a new chat session
   */
  async createSession(configId?: string, title?: string): Promise<ChatSession> {
    // Use provided configId or get default config
    let actualConfigId = configId;
    if (!actualConfigId) {
      const defaultConfig = await configManager.getDefaultConfig();
      if (!defaultConfig) {
        throw new Error('没有可用的配置，请先添加一个AI配置');
      }
      actualConfigId = defaultConfig.id;
    }

    // Verify config exists
    const config = await configManager.getConfig(actualConfigId);
    if (!config) {
      throw new Error(`配置不存在: ${actualConfigId}`);
    }

    const input: CreateSessionInput = {
      configId: actualConfigId,
      title
    };

    const session = createChatSession(input);
    await storageManager.saveSession(session);
    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | undefined> {
    return storageManager.loadSession(sessionId);
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<ChatSession[]> {
    return storageManager.loadAllSessions();
  }

  /**
   * Get session previews for history list
   */
  async getSessionPreviews(): Promise<SessionPreview[]> {
    const sessions = await storageManager.loadAllSessions();
    return sessions.map(session => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
      firstMessagePreview: session.messages[0]?.content.substring(0, 50)
    }));
  }

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const session = await storageManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    session.title = title;
    session.updatedAt = new Date();
    await storageManager.saveSession(session);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Cancel any active stream for this session
    this.cancelStream(sessionId);
    await storageManager.deleteSession(sessionId);
  }

  /**
   * Switch session's config
   * Note: This only changes the config, does NOT update updatedAt
   * because switching model is not a content change
   */
  async switchSessionConfig(sessionId: string, configId: string): Promise<void> {
    const session = await storageManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const config = await configManager.getConfig(configId);
    if (!config) {
      throw new Error(`配置不存在: ${configId}`);
    }

    session.configId = configId;
    // Do NOT update updatedAt - switching model is not a content change
    // session.updatedAt = new Date();
    await storageManager.saveSession(session);
  }

  // ============================================
  // Message Management
  // ============================================

  /**
   * Send a message and get streaming response
   */
  async sendMessage(
    sessionId: string, 
    content: string, 
    images?: ImageAttachment[],
    imageParams?: ImageGenerationParams
  ): Promise<Message> {
    // Load session
    const session = await storageManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // Load config
    const config = await configManager.getConfig(session.configId);
    if (!config) {
      throw new Error(`配置不存在: ${session.configId}`);
    }

    // Create and save user message
    const userMessage = createMessage({
      sessionId,
      role: 'user',
      content,
      images
    });
    await storageManager.saveMessage(userMessage);

    // Update session title if this is the first message
    if (session.messages.length === 0) {
      const newTitle = generateSessionTitle(content);
      await this.updateSessionTitle(sessionId, newTitle);
    }

    // Create assistant message placeholder
    const assistantMessage = createMessage({
      sessionId,
      role: 'assistant',
      content: ''
    });
    assistantMessage.isStreaming = true;
    await storageManager.saveMessage(assistantMessage);

    // Start streaming response
    this.streamResponse(sessionId, assistantMessage.id, config, session.messages.concat(userMessage), imageParams);

    return userMessage;
  }

  /**
   * Stream response from AI
   */
  private async streamResponse(
    sessionId: string,
    messageId: string,
    config: ModelConfig,
    history: Message[],
    imageParams?: ImageGenerationParams
  ): Promise<void> {
    const abortController = new AbortController();
    this.activeStreams.set(sessionId, abortController);

    // 根据模型类型设置不同的超时时间
    // 文生图模式需要更长的超时时间（5分钟），普通对话60秒
    const isImageGeneration = config.provider === 'image-generation';
    const TIMEOUT_MS = isImageGeneration ? 300000 : 60000; // 5分钟 vs 1分钟
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastChunkTime = Date.now();

    try {
      // Notify stream start
      this.callbacks.onStreamStart?.(sessionId, messageId);

      // Create adapter and send message
      const adapter = createAdapter(config);
      const lastUserMessage = history[history.length - 1];
      
      let fullContent = '';
      
      // 设置超时检查
      const checkTimeout = () => {
        if (Date.now() - lastChunkTime > TIMEOUT_MS) {
          abortController.abort();
          const timeoutMsg = isImageGeneration 
            ? '图片生成超时（5分钟无响应），请重试'
            : '响应超时（60秒无响应）';
          this.callbacks.onStreamError?.(sessionId, messageId, timeoutMsg);
        }
      };
      timeoutId = setInterval(checkTimeout, 1000);
      
      // Stream response - pass imageParams for image generation
      for await (const chunk of adapter.sendMessage(
        lastUserMessage.content, 
        history.slice(0, -1), 
        lastUserMessage.images,
        imageParams
      )) {
        // Check if aborted
        if (abortController.signal.aborted) {
          break;
        }

        // 更新最后收到数据的时间
        lastChunkTime = Date.now();
        
        // Check for content replacement marker (used by image generation)
        if (chunk.startsWith(REPLACE_CONTENT_MARKER)) {
          // Replace all previous content with new content
          fullContent = chunk.substring(REPLACE_CONTENT_MARKER.length);
        } else {
          // Normal append
          fullContent += chunk;
        }
        
        // Notify chunk received
        this.callbacks.onStreamChunk?.(sessionId, messageId, chunk, fullContent);

        // Update message in storage periodically (every 100 chars)
        if (fullContent.length % 100 < chunk.length) {
          await this.updateStreamingMessage(sessionId, messageId, fullContent, true);
        }
      }

      // 清除超时检查
      if (timeoutId) {
        clearInterval(timeoutId);
        timeoutId = null;
      }

      // Finalize message
      await this.updateStreamingMessage(sessionId, messageId, fullContent, false);
      
      // Notify stream end
      this.callbacks.onStreamEnd?.(sessionId, messageId, fullContent);

    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : '未知错误';
      let friendlyMessage = errorMessage;
      
      // 转换为用户友好的错误提示
      const lowerError = errorMessage.toLowerCase();
      
      // 图片不支持
      if (lowerError.includes('vision') || 
          lowerError.includes('image') || 
          lowerError.includes('multimodal') ||
          lowerError.includes('does not support') ||
          lowerError.includes('不支持')) {
        friendlyMessage = '当前模型不支持图片，请在右上角切换支持视觉的模型（如 GPT-4o、Claude 3）';
      }
      // API Key 错误
      else if (lowerError.includes('401') || 
               lowerError.includes('403') || 
               lowerError.includes('unauthorized') ||
               lowerError.includes('invalid api key') ||
               lowerError.includes('authentication')) {
        friendlyMessage = 'API Key 无效或已过期，请检查配置中的 API Key';
      }
      // 模型不存在
      else if (lowerError.includes('404') || 
               lowerError.includes('model not found') ||
               lowerError.includes('does not exist')) {
        friendlyMessage = '模型不存在，请检查配置中的模型名称是否正确';
      }
      // 网络错误
      else if (lowerError.includes('network') || 
               lowerError.includes('fetch') ||
               lowerError.includes('econnrefused') ||
               lowerError.includes('enotfound') ||
               lowerError.includes('dns') ||
               lowerError.includes('connection')) {
        friendlyMessage = '网络连接失败，请检查网络或 API 地址是否正确';
      }
      // 超时 - 可能是配置错误或网络问题
      else if (lowerError.includes('timeout') || 
               lowerError.includes('超时') ||
               lowerError.includes('timed out')) {
        if (isImageGeneration) {
          friendlyMessage = '图片生成超时，请检查：\n1. API Token 是否正确\n2. 网络连接是否正常\n3. 稍后重试';
        } else {
          friendlyMessage = '连接超时，请检查：\n1. API Key 是否正确\n2. API 地址是否可访问\n3. 网络连接是否正常';
        }
      }
      // 请求过多
      else if (lowerError.includes('429') || 
               lowerError.includes('rate limit') ||
               lowerError.includes('too many')) {
        friendlyMessage = '请求过于频繁，请稍后再试';
      }
      // 服务器错误
      else if (lowerError.includes('500') || 
               lowerError.includes('502') ||
               lowerError.includes('503') ||
               lowerError.includes('server error')) {
        friendlyMessage = '服务器暂时不可用，请稍后重试';
      }
      // 余额不足
      else if (lowerError.includes('insufficient') || 
               lowerError.includes('quota') ||
               lowerError.includes('balance')) {
        friendlyMessage = 'API 额度不足，请检查账户余额';
      }
      // 图片生成失败 - 保留原始错误信息
      else if (lowerError.includes('图像生成') || 
               lowerError.includes('图片生成') ||
               lowerError.includes('image generation')) {
        friendlyMessage = errorMessage;
      }
      
      // Update message with error
      await this.updateStreamingMessage(sessionId, messageId, `${friendlyMessage}`, false);
      
      // Notify error
      this.callbacks.onStreamError?.(sessionId, messageId, friendlyMessage);
    } finally {
      if (timeoutId) {
        clearInterval(timeoutId);
      }
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Update a streaming message
   */
  private async updateStreamingMessage(
    sessionId: string,
    messageId: string,
    content: string,
    isStreaming: boolean
  ): Promise<void> {
    const session = await storageManager.loadSession(sessionId);
    if (!session) return;

    const message = session.messages.find(m => m.id === messageId);
    if (message) {
      message.content = content;
      message.isStreaming = isStreaming;
      await storageManager.saveMessage(message);
    }
  }

  /**
   * Cancel an active stream
   */
  cancelStream(sessionId: string): void {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Check if a session has an active stream
   */
  isStreaming(sessionId: string): boolean {
    return this.activeStreams.has(sessionId);
  }

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string): Promise<Message[]> {
    return storageManager.loadMessages(sessionId);
  }

  /**
   * Delete a message
   */
  async deleteMessage(sessionId: string, messageId: string): Promise<void> {
    await storageManager.deleteMessage(sessionId, messageId);
  }

  /**
   * Resend a user message (delete all messages after it and regenerate)
   * Returns the new assistant message ID
   */
  async resendMessage(sessionId: string, messageId: string): Promise<{ assistantMessageId: string; messages: Message[] }> {
    const session = await storageManager.loadSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // Find the message index
    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      throw new Error(`消息不存在: ${messageId}`);
    }

    const userMessage = session.messages[messageIndex];
    if (userMessage.role !== 'user') {
      throw new Error('只能重新发送用户消息');
    }

    // Get config
    const config = await configManager.getConfig(session.configId);
    if (!config) {
      throw new Error(`配置不存在: ${session.configId}`);
    }

    // Delete all messages after this one from storage
    const messagesToDelete = session.messages.slice(messageIndex + 1);
    for (const msg of messagesToDelete) {
      await storageManager.deleteMessage(sessionId, msg.id);
    }

    // Create new assistant message placeholder
    const assistantMessage = createMessage({
      sessionId,
      role: 'assistant',
      content: ''
    });
    assistantMessage.isStreaming = true;
    await storageManager.saveMessage(assistantMessage);

    // Get history up to and including the user message
    const history = session.messages.slice(0, messageIndex + 1);

    // Stream new response
    this.streamResponse(sessionId, assistantMessage.id, config, history);

    // Return the new messages list (history + new assistant message)
    return {
      assistantMessageId: assistantMessage.id,
      messages: [...history, assistantMessage]
    };
  }

  /**
   * Regenerate the last assistant response
   */
  async regenerateLastResponse(sessionId: string): Promise<void> {
    const session = await storageManager.loadSession(sessionId);
    if (!session || session.messages.length < 2) {
      throw new Error('没有可重新生成的消息');
    }

    // Find last assistant message
    const lastAssistantIndex = session.messages.findLastIndex(m => m.role === 'assistant');
    if (lastAssistantIndex === -1) {
      throw new Error('没有找到助手消息');
    }

    // Find the user message before it
    const userMessageIndex = session.messages.slice(0, lastAssistantIndex).findLastIndex(m => m.role === 'user');
    if (userMessageIndex === -1) {
      throw new Error('没有找到用户消息');
    }

    // Delete the old assistant message
    const oldAssistantMessage = session.messages[lastAssistantIndex];
    await storageManager.deleteMessage(sessionId, oldAssistantMessage.id);

    // Get config
    const config = await configManager.getConfig(session.configId);
    if (!config) {
      throw new Error(`配置不存在: ${session.configId}`);
    }

    // Create new assistant message
    const newAssistantMessage = createMessage({
      sessionId,
      role: 'assistant',
      content: ''
    });
    newAssistantMessage.isStreaming = true;
    await storageManager.saveMessage(newAssistantMessage);

    // Get history up to and including the user message
    const history = session.messages.slice(0, userMessageIndex + 1);

    // Stream new response
    this.streamResponse(sessionId, newAssistantMessage.id, config, history);
  }
}

// Export singleton instance
export const chatManager = new ChatManager();
