import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import http from 'node:http';

/**
 * Standard error response format.
 *
 * @example
 * // Error biasa
 * { Metadata: { code: 404, message: "Coffee not found" }, Data: null }
 *
 * // Validation error (dari class-validator)
 * { Metadata: { code: 400, message: "Name is required", errors: { "name": ["Name is required"] } }, Data: null }
 *
 * // Internal server error (development)
 * { Metadata: { code: 500, message: 'relation "coffees" does not exist' }, Data: null }
 *
 * // Internal server error (production)
 * { Metadata: { code: 500, message: "Internal Server Error" }, Data: null }
 */
export interface ErrorResponse {
  Metadata: {
    code: number;
    message: string;
    errors?: Record<string, string[]>;
  };
  Data: null;
}

/**
 * Filter untuk handle semua exception dan format ke response standar.
 *
 * Behavior:
 * - HttpException (NotFoundException, BadRequestException, dll) → tampilkan message asli
 * - Non-HttpException (database error, dll) → 500 Internal Server Error
 * - Semua error di-log ke console server untuk debugging
 * - Development: tampilkan message detail error di response
 * - Production: sembunyikan detail error, tampilkan generic HTTP status message
 *
 * @example
 * // 1. HttpException - otomatis format
 * throw new NotFoundException('Coffee not found');
 * // Response: { Metadata: { code: 404, message: "Coffee not found" }, Data: null }
 *
 * // 2. Validation error (dengan class-validator)
 * throw new BadRequestException([{ field: 'name', message: 'Name is required' }]);
 * // Response: { Metadata: { code: 400, message: "Name is required", errors: {...} }, Data: null }
 *
 * // 3. Database error - otomatis 500
 * await this.db.query('SELECT * FROM invalid_table');
 * // Response: { Metadata: { code: 500, message: "Internal Server Error" }, Data: null }
 * // Console: [GET] /coffees 500: <error object>
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = http.STATUS_CODES[status] || 'Internal Server Error';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;

      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse !== null) {
        const res = exResponse as any;

        // Handle validation error format dari class-validator
        if (res.message && Array.isArray(res.message)) {
          errors = { [res.error || 'validation']: res.message };
          message = res.message[0] || message;
        } else if (res.message) {
          message = res.message;
        }
      }
    }

    // Log error ke console untuk debugging
    console.error(
      `[${response.req.method}] ${response.req.url} ${status}:`,
      exception,
    );

    // Development: tampilkan message asli, Production: sembunyikan
    const isDev = process.env.NODE_ENV === 'development';

    const errorResponse: ErrorResponse = {
      Metadata: {
        code: status,
        message: isDev
          ? message
          : http.STATUS_CODES[status] || 'Internal Server Error',
        ...(errors && { errors }),
      },
      Data: null,
    };

    response.status(status).json(errorResponse);
  }
}
