/**
 * Webhook Configuration Model
 * Manages webhook endpoints for outgoing notification delivery
 */

export enum WebhookEvent {
  ALL = 'ALL',
  CANDIDATE_APPLIED = 'CANDIDATE_APPLIED',
  CANDIDATE_STATUS_CHANGED = 'CANDIDATE_STATUS_CHANGED',
  JOB_POSTED = 'JOB_POSTED',
  JOB_APPLICATION_RECEIVED = 'JOB_APPLICATION_RECEIVED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  COMMENT_CREATED = 'COMMENT_CREATED',
  COMMENT_MENTION = 'COMMENT_MENTION',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
  FAILED = 'FAILED' // Automatically set after consecutive failures
}

export interface WebhookDeliveryAttempt {
  attemptedAt: Date;
  statusCode?: number;
  success: boolean;
  error?: string;
  responseTime?: number; // milliseconds
}

export interface WebhookConfig {
  webhookId: string;
  userId: string;
  
  // Endpoint configuration
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>; // Custom headers (e.g., Authorization)
  secret?: string; // For signature verification
  
  // Event filtering
  events: WebhookEvent[]; // Which events to send
  
  // Status and health
  status: WebhookStatus;
  isActive: boolean;
  
  // Retry configuration
  maxRetries: number;
  retryBackoff: 'linear' | 'exponential'; // Retry delay strategy
  timeoutMs: number; // Request timeout
  
  // Delivery tracking
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  consecutiveFailures: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastAttempts: WebhookDeliveryAttempt[]; // Keep last 10 attempts
  
  // Metadata
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateWebhookData {
  userId: string;
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string;
  events: WebhookEvent[];
  description?: string;
  maxRetries?: number;
  retryBackoff?: 'linear' | 'exponential';
  timeoutMs?: number;
  createdBy: string;
}

export interface UpdateWebhookData {
  url?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string;
  events?: WebhookEvent[];
  status?: WebhookStatus;
  isActive?: boolean;
  description?: string;
  maxRetries?: number;
  retryBackoff?: 'linear' | 'exponential';
  timeoutMs?: number;
}

export interface WebhookPayload {
  webhookId: string;
  event: string;
  timestamp: Date;
  notification: {
    notificationId: string;
    type: string;
    category: string;
    priority: string;
    title: string;
    message: string;
    data: Record<string, any>;
  };
  signature?: string; // HMAC signature if secret is configured
}
