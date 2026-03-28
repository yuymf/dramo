/**
 * Unified error types for the application
 * 统一错误类型定义
 */

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface ErrorDetails {
  field?: string;
  value?: unknown;
  reason?: string;
}

/**
 * Error codes used throughout the application
 */
export enum ErrorCode {
  // Validation errors (400)
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  
  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  
  // Rate limiting (429)
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Upstream/service errors (5xx)
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  UPSTREAM_RATE_LIMITED = 'UPSTREAM_RATE_LIMITED',
  
  // Internal errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  GENERATION_ERROR = 'GENERATION_ERROR',
  WORKER_ERROR = 'WORKER_ERROR',

  // Billing errors
  ALREADY_SUBSCRIBED = 'ALREADY_SUBSCRIBED',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  NO_STRIPE_CUSTOMER = 'NO_STRIPE_CUSTOMER',

  // LLM Config errors
  LLM_NOT_CONFIGURED = 'LLM_NOT_CONFIGURED',
  LLM_AUTH_FAILED = 'LLM_AUTH_FAILED',
  LLM_CONFIG_NOT_FOUND = 'LLM_CONFIG_NOT_FOUND',
  LLM_CONFIG_DUPLICATE_NAME = 'LLM_CONFIG_DUPLICATE_NAME',
  LLM_CONFIG_LIMIT_EXCEEDED = 'LLM_CONFIG_LIMIT_EXCEEDED',
}

/**
 * Map ErrorCode to HTTP status code
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UPSTREAM_TIMEOUT]: 504,
  [ErrorCode.UPSTREAM_RATE_LIMITED]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.GENERATION_ERROR]: 500,
  [ErrorCode.WORKER_ERROR]: 500,
  [ErrorCode.ALREADY_SUBSCRIBED]: 400,
  [ErrorCode.UPSTREAM_ERROR]: 502,
  [ErrorCode.PLAN_LIMIT_EXCEEDED]: 403,
  [ErrorCode.NO_STRIPE_CUSTOMER]: 400,
  [ErrorCode.LLM_NOT_CONFIGURED]: 403,
  [ErrorCode.LLM_AUTH_FAILED]: 401,
  [ErrorCode.LLM_CONFIG_NOT_FOUND]: 404,
  [ErrorCode.LLM_CONFIG_DUPLICATE_NAME]: 409,
  [ErrorCode.LLM_CONFIG_LIMIT_EXCEEDED]: 400,
};

/**
 * Custom exception class with error code and HTTP status
 */
export class AppException extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode | string,
    message: string,
    options?: { retryable?: boolean; details?: unknown; statusCode?: number }
  ) {
    super(message);
    this.name = 'AppException';
    this.code = code;
    this.statusCode = options?.statusCode ?? ERROR_STATUS_MAP[code] ?? 500;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

/**
 * Create a standardized error object
 */
export function createError(
  code: ErrorCode | string,
  message: string,
  retryable: boolean = false,
  details?: unknown
): AppError {
  return {
    code,
    message,
    retryable,
    details,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error) {
    return (error as AppError).retryable === true;
  }
  return false;
}

/**
 * Extract error code from error
 */
export function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    if ('message' in error && typeof error.message === 'string') {
      // Try to extract code from message (e.g., "AGENTOS_400")
      const match = error.message.match(/^(AGENTOS_|INVALID_|NOT_FOUND_|RATE_LIMITED_|UPSTREAM_)/);
      if (match) {
        return match[0].replace(/_$/, '');
      }
    }
  }
  return ErrorCode.INTERNAL_ERROR;
}

/**
 * Extract error message from error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}
