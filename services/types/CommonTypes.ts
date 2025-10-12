// =======================
// COMMON SERVICE TYPES
// =======================
// Purpose: Common interfaces and types used across multiple services
// Related: All services for shared functionality
// =======================

/**
 * Standard service operation result
 */
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

/**
 * Pagination parameters for service operations
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination result with metadata
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Filter options for data queries
 */
export interface FilterOptions {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  category?: string;
  search?: string;
  tags?: string[];
}

/**
 * File upload/processing result
 */
export interface FileProcessingResult {
  success: boolean;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
  url?: string;
  error?: string;
  processingTime?: number;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  totalItems: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    item: any;
    error: string;
  }>;
  duration: number;
}

/**
 * Search configuration
 */
export interface SearchOptions {
  query: string;
  fields?: string[];
  fuzzy?: boolean;
  caseSensitive?: boolean;
  limit?: number;
  filters?: FilterOptions;
}

/**
 * Cache configuration
 */
export interface CacheOptions {
  key: string;
  ttl?: number; // Time to live in seconds
  refresh?: boolean;
  tags?: string[];
}

/**
 * Video processing types
 */
export type VideoType = 'interview' | 'introduction';

/**
 * File types supported by the system
 */
export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'mp4' | 'webm' | 'avi';

/**
 * Operation context for tracking operations
 */
export interface OperationContext {
  userId?: string;
  operation: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}