import type {
  ModelConfig,
  CreateConfigInput,
  Message,
  CreateMessageInput,
  ChatSession,
  CreateSessionInput
} from '../../types';
import { generateConfigId, generateSessionId, generateMessageId } from '../utils';

/** Create a new ModelConfig */
export function createModelConfig(input: CreateConfigInput): ModelConfig {
  return {
    id: generateConfigId(),
    name: input.name,
    provider: input.provider,
    apiUrl: input.apiUrl,
    modelName: input.modelName,
    apiKey: input.apiKey,
    isDefault: input.isDefault ?? false,
    createdAt: new Date()
  };
}

/** Create a new Message */
export function createMessage(input: CreateMessageInput): Message {
  return {
    id: generateMessageId(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    images: input.images,
    timestamp: new Date(),
    isStreaming: false
  };
}

/** Create a new ChatSession */
export function createChatSession(input: CreateSessionInput): ChatSession {
  const now = new Date();
  return {
    id: generateSessionId(),
    configId: input.configId,
    title: input.title ?? '新对话',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

/** Generate a session title from first message */
export function generateSessionTitle(firstMessage: string): string {
  const maxLength = 30;
  const trimmed = firstMessage.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.substring(0, maxLength) + '...';
}
