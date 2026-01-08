import type {
  ModelConfig,
  SerializedModelConfig,
  Message,
  SerializedMessage,
  ChatSession,
  SerializedChatSession
} from '../../types';

// ============================================
// ModelConfig Serialization
// ============================================

/** Serialize ModelConfig for storage */
export function serializeConfig(config: ModelConfig): SerializedModelConfig {
  return {
    ...config,
    createdAt: config.createdAt.toISOString()
  };
}

/** Deserialize ModelConfig from storage */
export function deserializeConfig(data: SerializedModelConfig): ModelConfig {
  return {
    ...data,
    createdAt: new Date(data.createdAt)
  };
}

// ============================================
// Message Serialization
// ============================================

/** Serialize Message for storage */
export function serializeMessage(message: Message): SerializedMessage {
  return {
    ...message,
    timestamp: message.timestamp.toISOString()
  };
}

/** Deserialize Message from storage */
export function deserializeMessage(data: SerializedMessage): Message {
  return {
    ...data,
    timestamp: new Date(data.timestamp)
  };
}

// ============================================
// ChatSession Serialization
// ============================================

/** Serialize ChatSession for storage */
export function serializeSession(session: ChatSession): SerializedChatSession {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map(serializeMessage)
  };
}

/** Deserialize ChatSession from storage */
export function deserializeSession(data: SerializedChatSession): ChatSession {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    messages: data.messages.map(deserializeMessage)
  };
}

// ============================================
// Equality Checks (for testing)
// ============================================

/** Check if two configs are equivalent (ignoring Date object reference) */
export function configsEqual(a: ModelConfig, b: ModelConfig): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.provider === b.provider &&
    a.apiUrl === b.apiUrl &&
    a.modelName === b.modelName &&
    a.apiKey === b.apiKey &&
    a.isDefault === b.isDefault &&
    a.createdAt.getTime() === b.createdAt.getTime()
  );
}

/** Check if two messages are equivalent */
export function messagesEqual(a: Message, b: Message): boolean {
  return (
    a.id === b.id &&
    a.sessionId === b.sessionId &&
    a.role === b.role &&
    a.content === b.content &&
    a.timestamp.getTime() === b.timestamp.getTime()
  );
}

/** Check if two sessions are equivalent */
export function sessionsEqual(a: ChatSession, b: ChatSession): boolean {
  if (
    a.id !== b.id ||
    a.configId !== b.configId ||
    a.title !== b.title ||
    a.createdAt.getTime() !== b.createdAt.getTime() ||
    a.updatedAt.getTime() !== b.updatedAt.getTime() ||
    a.messages.length !== b.messages.length
  ) {
    return false;
  }
  
  return a.messages.every((msg, i) => messagesEqual(msg, b.messages[i]));
}
