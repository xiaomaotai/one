import { v4 as uuidv4 } from 'uuid';

/** Generate a unique ID */
export function generateId(): string {
  return uuidv4();
}

/** Generate a config ID */
export function generateConfigId(): string {
  return `config-${generateId()}`;
}

/** Generate a session ID */
export function generateSessionId(): string {
  return `session-${generateId()}`;
}

/** Generate a message ID */
export function generateMessageId(): string {
  return `msg-${generateId()}`;
}
