/**
 * HTTP Status Code Constants
 * Centralized status codes to improve code readability and maintainability
 */

// 2xx Success
export const OK = 200;
export const CREATED = 201;
export const NO_CONTENT = 204;

// 4xx Client Errors
export const BAD_REQUEST = 400;
export const UNAUTHORIZED = 401;
export const FORBIDDEN = 403;
export const NOT_FOUND = 404;
export const CONFLICT = 409;
export const UNPROCESSABLE_ENTITY = 422;

// 5xx Server Errors
export const INTERNAL_SERVER_ERROR = 500;
export const SERVICE_UNAVAILABLE = 503;
