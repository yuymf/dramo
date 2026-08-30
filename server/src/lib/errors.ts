/**
 * Unified error types for the application
 */

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  UPSTREAM_RATE_LIMITED = 'UPSTREAM_RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  GENERATION_ERROR = 'GENERATION_ERROR',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  LLM_NOT_CONFIGURED = 'LLM_NOT_CONFIGURED',
  LLM_AUTH_FAILED = 'LLM_AUTH_FAILED',
  LLM_CONFIG_NOT_FOUND = 'LLM_CONFIG_NOT_FOUND',
  LLM_CONFIG_DUPLICATE_NAME = 'LLM_CONFIG_DUPLICATE_NAME',
  LLM_CONFIG_LIMIT_EXCEEDED = 'LLM_CONFIG_LIMIT_EXCEEDED',
}

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
  [ErrorCode.UPSTREAM_ERROR]: 502,
  [ErrorCode.LLM_NOT_CONFIGURED]: 403,
  [ErrorCode.LLM_AUTH_FAILED]: 401,
  [ErrorCode.LLM_CONFIG_NOT_FOUND]: 404,
  [ErrorCode.LLM_CONFIG_DUPLICATE_NAME]: 409,
  [ErrorCode.LLM_CONFIG_LIMIT_EXCEEDED]: 400,
};

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
