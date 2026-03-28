import type { ErrorHandler } from 'hono';
import { logger } from '../lib/logger';
import { AppException } from '../lib/errors';
import type { AuthEnv } from './auth';

/**
 * Unified error handler for Hono.
 * Converts all errors to the standard envelope: { error: { code, message, retryable }, requestId }
 */
export const errorHandler: ErrorHandler<AuthEnv> = (error, c) => {
  const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? 'unknown';
  const url = c.req.path;
  const method = c.req.method;

  logger.error({ err: error, url, method, requestId }, 'Request error');

  // AppException: structured error with code and status
  if (error instanceof AppException) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          ...(error.details ? { details: error.details } : {}),
        },
        requestId,
      },
      error.statusCode as 400
    );
  }

  // String-based error matching for legacy patterns
  const msg = error.message ?? '';

  if (msg.includes('UPSTREAM_RATE_LIMITED')) {
    return c.json(
      { error: { code: 'UPSTREAM_RATE_LIMITED', message: '上游服务限流', retryable: true }, requestId },
      503
    );
  }

  if (msg.includes('RATE_LIMITED')) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: '请求频率超限', retryable: true }, requestId },
      429
    );
  }

  if (msg.includes('NOT_FOUND')) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: '资源不存在', retryable: false }, requestId },
      404
    );
  }

  if (msg.includes('UPSTREAM_TIMEOUT') || msg.includes('AGENTOS_TIMEOUT')) {
    return c.json(
      { error: { code: 'UPSTREAM_TIMEOUT', message: '上游服务超时', retryable: true }, requestId },
      504
    );
  }

  // Default: 500 internal error
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        retryable: true,
      },
      requestId,
    },
    500
  );
};
