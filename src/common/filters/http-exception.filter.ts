import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Global exception filter that normalizes all errors into a consistent JSON envelope:
 *
 * ```json
 * {
 *   "statusCode": 400,
 *   "error": "Bad Request",
 *   "message": ["field must not be empty"],
 *   "path": "/invoices",
 *   "timestamp": "2025-03-06T10:00:00.000Z"
 * }
 * ```
 *
 * Handles:
 * - `HttpException` subclasses (including NestJS `ValidationPipe` errors,
 *   `NotFoundException`, `NotImplementedException`, etc.)
 * - Unexpected errors — returned as 500 Internal Server Error without leaking
 *   internal details to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolve(exception);

    const body: ErrorBody = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): { statusCode: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      // ValidationPipe returns { message: string[], error: string, statusCode: number }
      if (typeof res === 'object' && res !== null && 'message' in res) {
        return { statusCode: status, message: (res as { message: string | string[] }).message };
      }

      return { statusCode: status, message: exception.message };
    }

    // Unexpected errors — log internally, return generic 500
    console.error('[HttpExceptionFilter] Unexpected error:', exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
