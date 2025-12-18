/**
 * Gemini Client Service
 * Centralized wrapper for all Gemini API calls
 * Automatically captures metrics: latency, tokens, errors, costs
 */

import fetch, { Response } from "node-fetch";
import { ObjectId, Db } from "mongodb";
import { connectDB } from "../mongo_db";
import { AIMetricsRepository } from "../repositories/AIMetricsRepository";
import {
  AIMetricsEntry,
  AIServiceType,
  AIErrorCategory,
  TokenUsage,
  CostEstimate,
  GEMINI_PRICING,
  DEFAULT_MODEL_VERSION,
  TOKEN_ESTIMATION,
} from "../Models/AIMetrics";

// ============================================================================
// Types
// ============================================================================

/**
 * Gemini API response structure
 */
export interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text: string }[];
    };
    finishReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Request context for metrics tracking
 */
export interface GeminiRequestContext {
  service: AIServiceType;
  candidateId?: string;
  jobId?: string;
  userId?: string;
  userEmail?: string;
  promptVersion?: string;
}

/**
 * Result from Gemini API call
 */
export interface GeminiCallResult<T = string> {
  success: boolean;
  data?: T;
  rawText?: string;
  error?: string;
  errorCategory?: AIErrorCategory;
  metricsId: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class GeminiClientService {
  private static instance: GeminiClientService;
  private db: Db | null = null;
  private metricsRepo: AIMetricsRepository | null = null;
  private modelVersion: string;
  private apiKey: string | undefined;

  constructor(modelVersion: string = DEFAULT_MODEL_VERSION) {
    this.modelVersion = modelVersion;
    this.apiKey = process.env.GOOGLE_API_KEY;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GeminiClientService {
    if (!GeminiClientService.instance) {
      GeminiClientService.instance = new GeminiClientService();
    }
    return GeminiClientService.instance;
  }

  /**
   * Initialize database connection
   */
  private async init(): Promise<void> {
    if (!this.db) {
      this.db = await connectDB();
      this.metricsRepo = new AIMetricsRepository(this.db);
    }
  }

  /**
   * Validate API key is present
   */
  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable is not set");
    }
  }

  // ============================================================================
  // Main API Call Methods
  // ============================================================================

  /**
   * Call Gemini API and return raw text response
   * Automatically logs metrics
   */
  async callGemini(
    prompt: string,
    context: GeminiRequestContext,
    fileUri?: string
  ): Promise<GeminiCallResult<string>> {
    await this.init();
    this.validateApiKey();

    const metricsId = new ObjectId().toString();
    const startTime = Date.now();
    let httpStatusCode: number | undefined;
    let rawResponse: GeminiResponse | null = null;

    try {
      // Build parts array - include file URI if provided (for video/image analysis)
      const parts: any[] = [{ text: prompt }];
      if (fileUri) {
        parts.unshift({ fileData: { fileUri, mimeType: "video/mp4" } });
      }

      const requestPayload = {
        contents: [{ parts }],
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelVersion}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        }
      );

      httpStatusCode = response.status;
      const latencyMs = Date.now() - startTime;

      rawResponse = (await response.json()) as GeminiResponse;

      // Check for API-level errors
      if (rawResponse.error) {
        console.error("=== GEMINI API ERROR ===");
        console.error("Error Code:", rawResponse.error.code);
        console.error("Error Message:", rawResponse.error.message);
        console.error("Error Status:", rawResponse.error.status);
        console.error("========================");
        
        const errorCategory = this.categorizeApiError(
          rawResponse.error.code,
          rawResponse.error.message
        );

        await this.logMetrics({
          metricsId,
          context,
          startTime,
          latencyMs,
          success: false,
          errorCategory,
          errorMessage: rawResponse.error.message,
          httpStatusCode,
          inputLength: prompt.length,
          outputLength: 0,
          parseSuccess: false,
          fallbackUsed: false,
          tokenUsage: this.estimateTokens(prompt, ""),
          retryCount: 0,
        });

        return {
          success: false,
          error: rawResponse.error.message,
          errorCategory,
          metricsId,
          latencyMs,
          tokenUsage: this.estimateTokens(prompt, ""),
        };
      }

      // Extract content
      const contentText =
        rawResponse.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!contentText) {
        console.error("=== GEMINI EMPTY RESPONSE ===");
        console.error("HTTP Status:", httpStatusCode);
        console.error("Finish Reason:", rawResponse.candidates?.[0]?.finishReason);
        console.error("Safety Ratings:", JSON.stringify(rawResponse.candidates?.[0]?.safetyRatings));
        console.error("Full Response:", JSON.stringify(rawResponse, null, 2));
        console.error("=============================");
        
        await this.logMetrics({
          metricsId,
          context,
          startTime,
          latencyMs,
          success: false,
          errorCategory: AIErrorCategory.EMPTY_RESPONSE,
          errorMessage: "No content returned by Gemini",
          httpStatusCode,
          inputLength: prompt.length,
          outputLength: 0,
          parseSuccess: false,
          fallbackUsed: false,
          tokenUsage: this.getTokenUsage(rawResponse, prompt, ""),
          retryCount: 0,
        });

        return {
          success: false,
          error: "No content returned by Gemini",
          errorCategory: AIErrorCategory.EMPTY_RESPONSE,
          metricsId,
          latencyMs,
          tokenUsage: this.getTokenUsage(rawResponse, prompt, ""),
        };
      }

      // Success
      const tokenUsage = this.getTokenUsage(rawResponse, prompt, contentText);

      await this.logMetrics({
        metricsId,
        context,
        startTime,
        latencyMs,
        success: true,
        httpStatusCode,
        inputLength: prompt.length,
        outputLength: contentText.length,
        parseSuccess: true, // Just raw text, parsing happens in caller
        fallbackUsed: false,
        tokenUsage,
        retryCount: 0,
      });

      return {
        success: true,
        data: contentText,
        rawText: contentText,
        metricsId,
        latencyMs,
        tokenUsage,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCategory = this.categorizeNetworkError(errorMessage);

      await this.logMetrics({
        metricsId,
        context,
        startTime,
        latencyMs,
        success: false,
        errorCategory,
        errorMessage,
        httpStatusCode,
        inputLength: prompt.length,
        outputLength: 0,
        parseSuccess: false,
        fallbackUsed: false,
        tokenUsage: this.estimateTokens(prompt, ""),
        retryCount: 0,
      });

      return {
        success: false,
        error: errorMessage,
        errorCategory,
        metricsId,
        latencyMs,
        tokenUsage: this.estimateTokens(prompt, ""),
      };
    }
  }

  /**
   * Call Gemini and parse JSON response
   * Includes automatic JSON cleanup (removes markdown code blocks)
   */
  async callGeminiForJson<T>(
    prompt: string,
    context: GeminiRequestContext,
    validator?: (data: any) => boolean
  ): Promise<GeminiCallResult<T>> {
    const result = await this.callGemini(prompt, context);

    if (!result.success || !result.rawText) {
      return result as GeminiCallResult<T>;
    }

    try {
      // Clean JSON (remove markdown code blocks)
      const cleanedJson = this.cleanGeminiJson(result.rawText);
      const parsed = JSON.parse(cleanedJson) as T;

      // Validate if validator provided
      if (validator && !validator(parsed)) {
        // Update metrics to reflect validation failure
        await this.updateMetricsParseStatus(
          result.metricsId,
          false,
          AIErrorCategory.VALIDATION_FAILED
        );

        return {
          ...result,
          success: false,
          data: undefined,
          error: "Response validation failed",
          errorCategory: AIErrorCategory.VALIDATION_FAILED,
        };
      }

      // Update metrics to reflect successful parse
      await this.updateMetricsParseStatus(result.metricsId, true);

      return {
        ...result,
        success: true,
        data: parsed,
      };
    } catch (parseError) {
      const errorMessage =
        parseError instanceof Error ? parseError.message : "JSON parse error";

      // Update metrics to reflect parse failure
      await this.updateMetricsParseStatus(
        result.metricsId,
        false,
        AIErrorCategory.INVALID_JSON
      );

      return {
        ...result,
        success: false,
        data: undefined,
        error: `Invalid JSON: ${errorMessage}`,
        errorCategory: AIErrorCategory.INVALID_JSON,
      };
    }
  }

  // ============================================================================
  // Token & Cost Calculation
  // ============================================================================

  /**
   * Get token usage from API response or estimate
   */
  private getTokenUsage(
    response: GeminiResponse | null,
    inputText: string,
    outputText: string
  ): TokenUsage {
    // Try to get actual token counts from API response
    if (response?.usageMetadata) {
      return {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
        thoughtsTokens: response.usageMetadata.thoughtsTokenCount,
        isEstimated: false,
      };
    }

    // Fall back to estimation
    return this.estimateTokens(inputText, outputText);
  }

  /**
   * Estimate token count from text length
   */
  private estimateTokens(inputText: string, outputText: string): TokenUsage {
    const charsPerToken = TOKEN_ESTIMATION.CHARS_PER_TOKEN;
    const overhead = TOKEN_ESTIMATION.OVERHEAD_MULTIPLIER;

    const promptTokens = Math.ceil(
      (inputText.length / charsPerToken) * overhead
    );
    const completionTokens = Math.ceil(
      (outputText.length / charsPerToken) * overhead
    );

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      isEstimated: true,
    };
  }

  /**
   * Calculate cost from token usage
   */
  calculateCost(tokenUsage: TokenUsage): CostEstimate {
    const pricing =
      GEMINI_PRICING[this.modelVersion as keyof typeof GEMINI_PRICING] ||
      GEMINI_PRICING[DEFAULT_MODEL_VERSION as keyof typeof GEMINI_PRICING];

    const inputCostUsd =
      (tokenUsage.promptTokens / 1_000_000) * pricing.inputPer1M;
    const outputCostUsd =
      (tokenUsage.completionTokens / 1_000_000) * pricing.outputPer1M;

    return {
      inputCostUsd,
      outputCostUsd,
      totalCostUsd: inputCostUsd + outputCostUsd,
      isEstimated: tokenUsage.isEstimated,
    };
  }

  // ============================================================================
  // Error Categorization
  // ============================================================================

  /**
   * Categorize API-level errors
   */
  private categorizeApiError(code: number, message: string): AIErrorCategory {
    if (code === 429 || message.toLowerCase().includes("rate limit")) {
      return AIErrorCategory.RATE_LIMIT;
    }
    if (code === 401 || code === 403) {
      return AIErrorCategory.AUTHENTICATION;
    }
    if (code === 504 || message.toLowerCase().includes("timeout")) {
      return AIErrorCategory.TIMEOUT;
    }
    return AIErrorCategory.API_ERROR;
  }

  /**
   * Categorize network/fetch errors
   */
  private categorizeNetworkError(message: string): AIErrorCategory {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("timeout") ||
      lowerMessage.includes("timed out")
    ) {
      return AIErrorCategory.TIMEOUT;
    }
    if (lowerMessage.includes("rate") || lowerMessage.includes("429")) {
      return AIErrorCategory.RATE_LIMIT;
    }
    if (
      lowerMessage.includes("auth") ||
      lowerMessage.includes("401") ||
      lowerMessage.includes("403")
    ) {
      return AIErrorCategory.AUTHENTICATION;
    }

    return AIErrorCategory.API_ERROR;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Clean Gemini JSON response (remove markdown code blocks)
   */
  private cleanGeminiJson(raw: string): string {
    return raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  /**
   * Strip markdown formatting from text
   */
  stripMarkdown(text: string): string {
    if (!text || typeof text !== "string") return "";

    return text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/^>\s+/gm, "")
      .replace(/^[-*_]{3,}$/gm, "")
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ============================================================================
  // Metrics Logging
  // ============================================================================

  /**
   * Log metrics entry
   */
  private async logMetrics(params: {
    metricsId: string;
    context: GeminiRequestContext;
    startTime: number;
    latencyMs: number;
    success: boolean;
    errorCategory?: AIErrorCategory;
    errorMessage?: string;
    httpStatusCode?: number;
    inputLength: number;
    outputLength: number;
    parseSuccess: boolean;
    fallbackUsed: boolean;
    tokenUsage: TokenUsage;
    retryCount: number;
  }): Promise<void> {
    if (!this.metricsRepo) return;

    const costEstimate = this.calculateCost(params.tokenUsage);

    const entry: AIMetricsEntry = {
      metricsId: params.metricsId,
      timestamp: new Date(),
      service: params.context.service,
      modelVersion: this.modelVersion,
      promptVersion: params.context.promptVersion,
      candidateId: params.context.candidateId,
      jobId: params.context.jobId,
      userId: params.context.userId,
      userEmail: params.context.userEmail,
      latencyMs: params.latencyMs,
      tokenUsage: params.tokenUsage,
      costEstimate,
      success: params.success,
      errorCategory: params.errorCategory,
      errorMessage: params.errorMessage,
      httpStatusCode: params.httpStatusCode,
      parseSuccess: params.parseSuccess,
      fallbackUsed: params.fallbackUsed,
      outputLength: params.outputLength,
      retryCount: params.retryCount,
      inputLength: params.inputLength,
    };

    try {
      await this.metricsRepo.logMetrics(entry);
    } catch (error) {
      // Don't let metrics logging failures break the main flow
      console.error("Failed to log AI metrics:", error);
    }
  }

  /**
   * Update parse status after JSON parsing attempt
   */
  private async updateMetricsParseStatus(
    metricsId: string,
    parseSuccess: boolean,
    errorCategory?: AIErrorCategory
  ): Promise<void> {
    if (!this.db) return;

    try {
      const collection = this.db.collection("ai_metrics");
      const updateFields: any = { parseSuccess };

      if (!parseSuccess) {
        updateFields.success = false;
        if (errorCategory) {
          updateFields.errorCategory = errorCategory;
        }
      }

      await collection.updateOne({ metricsId }, { $set: updateFields });
    } catch (error) {
      console.error("Failed to update metrics parse status:", error);
    }
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  /**
   * Get the current model version
   */
  getModelVersion(): string {
    return this.modelVersion;
  }

  /**
   * Set the model version for future requests
   */
  setModelVersion(version: string): void {
    this.modelVersion = version;
  }
}

// Export singleton instance
export const geminiClient = GeminiClientService.getInstance();
