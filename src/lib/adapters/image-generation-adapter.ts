/**
 * Generic Image Generation Adapter
 * 
 * Implements the AIAdapter interface for text-to-image APIs.
 * Uses async polling for image generation tasks.
 * 
 * Supports APIs that follow the pattern:
 * 1. POST to /v1/images/generations with async mode
 * 2. GET /v1/tasks/{task_id} to poll for completion
 * 
 * Compatible with:
 * - ModelScope (api-inference.modelscope.cn)
 * - And other similar async image generation APIs
 * 
 * Note: Different APIs may support different parameters.
 * This adapter sends all configured parameters, but APIs will
 * typically ignore unsupported parameters without errors.
 */

import type { AIAdapter, Message, ImageAttachment, ImageGenerationParams } from '../../types';
import { nativePost, nativeGet } from '../utils/native-http';

interface ImageGenerationTaskResponse {
  task_id?: string;
  // Some APIs might use different field names
  taskId?: string;
  id?: string;
}

interface ImageGenerationStatusResponse {
  task_status?: 'PENDING' | 'RUNNING' | 'SUCCEED' | 'FAILED';
  // Alternative field names
  status?: string;
  state?: string;
  // Output images
  output_images?: string[];
  images?: string[];
  data?: Array<{ url?: string; b64_json?: string }>;
  // Error info
  error_message?: string;
  error?: string;
  message?: string;
}

export class ImageGenerationAdapter implements AIAdapter {
  apiKey: string;
  apiUrl: string;
  modelName: string;
  private maxPollingAttempts = 60;  // Max 5 minutes (60 * 5 seconds)
  private pollingInterval = 5000;   // 5 seconds

  constructor(apiKey: string, apiUrl: string, modelName: string) {
    this.apiKey = apiKey;
    // Ensure URL ends without trailing slash for consistency
    this.apiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    this.modelName = modelName;
  }

  /**
   * Build request body with only non-empty parameters
   * Different APIs support different parameters, so we only include
   * parameters that have been explicitly set
   */
  private buildRequestBody(prompt: string, params?: ImageGenerationParams): Record<string, unknown> {
    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      prompt: prompt
    };

    if (!params) {
      return requestBody;
    }

    // Size - try multiple formats for compatibility
    if (params.size) {
      requestBody.size = params.size;
      // Also try width/height format for some APIs
      const [width, height] = params.size.split('x').map(Number);
      if (width && height) {
        requestBody.width = width;
        requestBody.height = height;
      }
    }

    // Number of images - only if explicitly set and > 0
    if (params.n && params.n > 0) {
      requestBody.n = params.n;
      requestBody.num_images = params.n;
    }

    // Negative prompt - only if not empty
    if (params.negativePrompt && params.negativePrompt.trim()) {
      requestBody.negative_prompt = params.negativePrompt.trim();
    }

    // Guidance scale / CFG - only if explicitly set
    if (params.guidanceScale !== undefined && params.guidanceScale > 0) {
      requestBody.guidance_scale = params.guidanceScale;
      requestBody.cfg_scale = params.guidanceScale;
    }

    // Steps - only if explicitly set
    if (params.steps !== undefined && params.steps > 0) {
      requestBody.steps = params.steps;
      requestBody.num_inference_steps = params.steps;
    }

    // Seed - only if explicitly set (0 is a valid seed)
    if (params.seed !== undefined) {
      requestBody.seed = params.seed;
    }

    // Style - only if not empty
    if (params.style && params.style.trim()) {
      requestBody.style = params.style.trim();
      requestBody.style_preset = params.style.trim();
    }

    return requestBody;
  }

  /**
   * Generate an image from a text prompt
   * Returns the image URL
   */
  async generateImage(prompt: string, params?: ImageGenerationParams): Promise<string> {
    const requestBody = this.buildRequestBody(prompt, params);
    const requestUrl = `${this.apiUrl}/v1/images/generations`;

    console.log('[ImageGen] Request URL:', requestUrl);
    console.log('[ImageGen] Request body:', JSON.stringify(requestBody, null, 2));

    // Step 1: Submit the image generation task using native HTTP
    try {
      const submitResponse = await nativePost(requestUrl, requestBody, {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-ModelScope-Async-Mode': 'true'  // For ModelScope compatibility
      });

      console.log('[ImageGen] Submit response status:', submitResponse.status);
      console.log('[ImageGen] Submit response data:', submitResponse.data);

      if (submitResponse.status >= 400) {
        const errorText = typeof submitResponse.data === 'string' 
          ? submitResponse.data 
          : JSON.stringify(submitResponse.data);
        throw new Error(`图像生成 API 错误 (${submitResponse.status}): ${errorText}`);
      }

      const submitData = submitResponse.data as ImageGenerationTaskResponse;
      
      // Try to get task ID from various possible field names
      const taskId = submitData.task_id || submitData.taskId || submitData.id;

      if (!taskId) {
        // If no task ID, the API might return the image directly (synchronous mode)
        const directData = submitData as unknown as ImageGenerationStatusResponse;
        const imageUrl = this.extractImageUrl(directData);
        if (imageUrl) {
          return imageUrl;
        }
        throw new Error('无法获取任务 ID 或图像结果');
      }

      console.log('[ImageGen] Task ID:', taskId);

      // Step 2: Poll for task completion
      for (let attempt = 0; attempt < this.maxPollingAttempts; attempt++) {
        await this.sleep(this.pollingInterval);

        const statusUrl = `${this.apiUrl}/v1/tasks/${taskId}`;
        console.log(`[ImageGen] Polling attempt ${attempt + 1}: ${statusUrl}`);

        const statusResponse = await nativeGet(statusUrl, {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-ModelScope-Task-Type': 'image_generation'  // For ModelScope compatibility
        });

        console.log('[ImageGen] Status response:', statusResponse.status, statusResponse.data);

        if (statusResponse.status >= 400) {
          const errorText = typeof statusResponse.data === 'string' 
            ? statusResponse.data 
            : JSON.stringify(statusResponse.data);
          throw new Error(`任务状态查询错误 (${statusResponse.status}): ${errorText}`);
        }

        const statusData = statusResponse.data as ImageGenerationStatusResponse;
        
        // Check status using various possible field names
        const status = statusData.task_status || statusData.status || statusData.state;
        const normalizedStatus = status?.toUpperCase();

        console.log('[ImageGen] Task status:', normalizedStatus);

        if (normalizedStatus === 'SUCCEED' || normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED') {
          const imageUrl = this.extractImageUrl(statusData);
          if (imageUrl) {
            console.log('[ImageGen] Image URL:', imageUrl);
            return imageUrl;
          }
          throw new Error('图像生成成功但未返回图像');
        }

        if (normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR') {
          const errorMsg = statusData.error_message || statusData.error || statusData.message || '未知错误';
          throw new Error(`图像生成失败: ${errorMsg}`);
        }

        // Continue polling for PENDING, RUNNING, or other in-progress statuses
      }

      throw new Error('图像生成超时（超过5分钟）');
    } catch (error) {
      console.error('[ImageGen] Error:', error);
      throw error;
    }
  }

  /**
   * Extract image URL from response data
   */
  private extractImageUrl(data: ImageGenerationStatusResponse): string | null {
    // Try output_images array (ModelScope format)
    if (data.output_images && data.output_images.length > 0) {
      return data.output_images[0];
    }
    
    // Try images array
    if (data.images && data.images.length > 0) {
      return data.images[0];
    }
    
    // Try data array (OpenAI format)
    if (data.data && data.data.length > 0) {
      const firstImage = data.data[0];
      if (firstImage.url) {
        return firstImage.url;
      }
      if (firstImage.b64_json) {
        return `data:image/png;base64,${firstImage.b64_json}`;
      }
    }
    
    return null;
  }

  /**
   * Send a message and stream the response
   * For image generation, this yields a special marker with the image URL
   * 
   * Output format:
   * - During generation: "正在生成图片，请稍候..."
   * - On success: Only the image markdown (no waiting text)
   * - On failure: "❌ 图片生成失败: 错误信息"
   */
  async *sendMessage(
    message: string, 
    _history: Message[], 
    _images?: ImageAttachment[],
    imageParams?: ImageGenerationParams
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Yield initial status (this will be replaced on success) - no icon
      yield `正在生成图片，请稍候...\n`;

      // Generate the image
      const imageUrl = await this.generateImage(message, imageParams);

      // On success, yield ONLY the image - use special marker to indicate replacement
      // The marker __REPLACE_CONTENT__ tells the chat manager to replace previous content
      yield `__REPLACE_CONTENT__![生成的图片](${imageUrl})`;
    } catch (error) {
      console.error('[ImageGen] Error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      // On error, replace content with error message
      yield `__REPLACE_CONTENT__❌ 图片生成失败: ${errorMessage}`;
    }
  }

  /**
   * Validate API credentials by checking if we can access the API
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Try to make a simple request to check credentials
      const response = await nativePost(`${this.apiUrl}/v1/images/generations`, {
        model: this.modelName,
        prompt: 'test'
      }, {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-ModelScope-Async-Mode': 'true'
      });

      // If we get a 401 or 403, credentials are invalid
      if (response.status === 401 || response.status === 403) {
        return false;
      }

      // If we get a successful response or other errors, credentials might be valid
      return true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}