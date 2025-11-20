/**
 * Constants for comment system configuration
 * Centralized to avoid magic numbers and enable easy tuning
 */

/**
 * Maximum length for comment text (characters)
 */
export const MAX_COMMENT_TEXT_LENGTH = 5000;

/**
 * Maximum reply depth (number of nested levels)
 * Example: Top-level (1) -> Reply (2) -> Reply to reply (3) -> ... -> MAX (5)
 */
export const MAX_REPLY_DEPTH = 5;

/**
 * Minimum query length for autocomplete search
 * Prevents user enumeration attacks
 */
export const MIN_AUTOCOMPLETE_QUERY_LENGTH = 3;

/**
 * Default pagination page size
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Default pagination page size for user-specific queries (mentions, authored)
 */
export const DEFAULT_USER_PAGE_SIZE = 20;

/**
 * Maximum autocomplete results to return
 */
export const MAX_AUTOCOMPLETE_RESULTS = 10;
