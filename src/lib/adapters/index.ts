/**
 * Adapters Module
 * 
 * Exports all API adapters and factory functions.
 */

export { OpenAIAdapter } from './openai-adapter';
export { AnthropicAdapter } from './anthropic-adapter';
export { GoogleAdapter } from './google-adapter';
export { ImageGenerationAdapter } from './image-generation-adapter';
export { createAdapter, getDefaultApiUrl, getSuggestedModels, isImageGenerationProvider } from './adapter-factory';
