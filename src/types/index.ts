// ============================================
// Provider Types
// ============================================

/** Supported AI provider types */
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openai-compatible' | 'image-generation';

/** Provider display names for UI */
export const PROVIDER_NAMES: Record<AIProvider, string> = {
  'openai': 'OpenAI (ChatGPT)',
  'anthropic': 'Anthropic (Claude)',
  'google': 'Google (Gemini)',
  'openai-compatible': 'OpenAI 兼容',
  'image-generation': '文生图 (通用)'
};

/** Default API URLs for each provider */
export const DEFAULT_API_URLS: Record<AIProvider, string> = {
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com',
  'google': 'https://generativelanguage.googleapis.com/v1beta',
  'openai-compatible': '',
  'image-generation': ''
};

// ============================================
// Image Generation Parameters
// ============================================

/** Image generation parameters */
export interface ImageGenerationParams {
  /** Image size/resolution */
  size?: '512x512' | '768x768' | '1024x1024' | '1024x768' | '768x1024';
  /** Number of images to generate */
  n?: number;
  /** Negative prompt (what to avoid) */
  negativePrompt?: string;
  /** Guidance scale / CFG scale */
  guidanceScale?: number;
  /** Number of inference steps */
  steps?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Style preset */
  style?: string;
}

/** Default image generation parameters */
export const DEFAULT_IMAGE_PARAMS: ImageGenerationParams = {
  size: '1024x1024',
  n: 1,
  negativePrompt: '',
  guidanceScale: 7.5,
  steps: 30,
  seed: undefined,
  style: ''
};

// ============================================
// Message Types
// ============================================

/** Message role types */
export type MessageRole = 'user' | 'assistant';

/** Image attachment for messages */
export interface ImageAttachment {
  id: string;
  data: string;  // base64 data URL or remote URL
  mimeType: string;
  name?: string;
  isGenerated?: boolean;  // Flag for AI-generated images
}

/** Message interface */
export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  images?: ImageAttachment[];
  timestamp: Date;
  isStreaming?: boolean;
}

/** Create message input (without auto-generated fields) */
export interface CreateMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
  images?: ImageAttachment[];
}

// ============================================
// Model Configuration Types
// ============================================

/** Model configuration interface */
export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiUrl: string;
  modelName: string;
  apiKey: string;
  isDefault: boolean;
  createdAt: Date;
  sortOrder?: number;  // Sort order for drag-and-drop reordering
}

/** Create config input (without auto-generated fields) */
export interface CreateConfigInput {
  name: string;
  provider: AIProvider;
  apiUrl: string;
  modelName: string;
  apiKey: string;
  isDefault?: boolean;
}

/** Update config input (partial) */
export type UpdateConfigInput = Partial<Omit<ModelConfig, 'id' | 'createdAt'>>;

/** Config validation result */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
}

/** Config validation error */
export interface ConfigValidationError {
  field: keyof CreateConfigInput;
  message: string;
}

// ============================================
// Chat Session Types
// ============================================

/** Chat session interface */
export interface ChatSession {
  id: string;
  configId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

/** Create session input */
export interface CreateSessionInput {
  configId: string;
  title?: string;
}

/** Session preview for history list */
export interface SessionPreview {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  firstMessagePreview?: string;
}

// ============================================
// API Adapter Types
// ============================================

/** API adapter interface */
export interface AIAdapter {
  sendMessage(message: string, history: Message[], images?: ImageAttachment[], imageParams?: ImageGenerationParams): AsyncGenerator<string, void, unknown>;
  validateCredentials(): Promise<boolean>;
}

/** Image generation adapter interface */
export interface ImageGenerationAdapter extends AIAdapter {
  generateImage(prompt: string, params?: ImageGenerationParams): Promise<string>;  // Returns image URL
}

/** Stream chunk from API */
export interface StreamChunk {
  content: string;
  done: boolean;
}

// ============================================
// Storage Types
// ============================================

/** Storage manager interface */
export interface IStorageManager {
  // Config operations
  saveConfig(config: ModelConfig): Promise<void>;
  loadConfigs(): Promise<ModelConfig[]>;
  getConfig(id: string): Promise<ModelConfig | undefined>;
  deleteConfig(id: string): Promise<void>;
  
  // Session operations
  saveSession(session: ChatSession): Promise<void>;
  loadSession(id: string): Promise<ChatSession | undefined>;
  loadAllSessions(): Promise<ChatSession[]>;
  deleteSession(id: string): Promise<void>;
  
  // Message operations
  saveMessage(message: Message): Promise<void>;
  loadMessages(sessionId: string): Promise<Message[]>;
}

/** Serialized model config for storage (dates as strings) */
export interface SerializedModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiUrl: string;
  modelName: string;
  apiKey: string;
  isDefault: boolean;
  createdAt: string;
  sortOrder?: number;  // Sort order for drag-and-drop reordering
}

/** Serialized message for storage */
export interface SerializedMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  images?: ImageAttachment[];
  timestamp: string;
  isStreaming?: boolean;
}

/** Serialized chat session for storage */
export interface SerializedChatSession {
  id: string;
  configId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: SerializedMessage[];
}

// ============================================
// Error Types
// ============================================

/** Error codes */
export const ErrorCode = {
  // Config errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  DUPLICATE_CONFIG_NAME: 'DUPLICATE_CONFIG_NAME',
  
  // API errors
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  
  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  DATA_CORRUPTED: 'DATA_CORRUPTED',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  
  // Image generation errors
  IMAGE_GENERATION_FAILED: 'IMAGE_GENERATION_FAILED',
  IMAGE_GENERATION_TIMEOUT: 'IMAGE_GENERATION_TIMEOUT',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/** Application error */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Create an AppError */
export function createAppError(code: ErrorCode, message: string, details?: unknown): AppError {
  return { code, message, details };
}

// ============================================
// Utility Types
// ============================================

/** Loading state */
export interface LoadingState {
  isLoading: boolean;
  error: AppError | null;
}

/** Async operation result */
export type AsyncResult<T> = 
  | { success: true; data: T }
  | { success: false; error: AppError };
