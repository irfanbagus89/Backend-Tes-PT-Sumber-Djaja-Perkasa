import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import http from 'node:http';

/**
 * Standard API response format.
 *
 * @example
 * // Success with custom message
 * { Metadata: { code: 200, message: "Coffees retrieved" }, Data: [...] }
 *
 * // Success without custom message (default)
 * { Metadata: { code: 200, message: "OK" }, Data: {...} }
 */
export interface ApiResponse<T> {
  Metadata: {
    code: number;
    message: string;
  };
  Data: T;
}

/**
 * Interceptor untuk wrap semua success response ke format standar.
 *
 * Behavior:
 * - Return data biasa → message default dari HTTP status (200 → "OK", 201 → "Created")
 * - Return { message: "...", data: ... } → custom message, data diambil dari property lain
 * - Return null/undefined → Data: null
 *
 * @example
 * // 1. Tanpa custom message
 * @Get()
 * findAll() {
 *   return this.coffeesService.findAll();
 * }
 * // Response: { Metadata: { code: 200, message: "OK" }, Data: [...] }
 *
 * // 2. Dengan custom message
 * @Get()
 * findAll() {
 *   return { message: 'Coffees retrieved', data: this.coffeesService.findAll() };
 * }
 * // Response: { Metadata: { code: 200, message: "Coffees retrieved" }, Data: [...] }
 *
 * // 3. Return null
 * @Delete(':id')
 * remove(@Param('id') id: number) {
 *   return this.coffeesService.remove(id);
 * }
 * // Response: { Metadata: { code: 200, message: "OK" }, Data: null }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((data) => {
        let message = http.STATUS_CODES[statusCode] || 'OK';
        let responseData = data ?? null;

        // Jika return value punya property "message", pisahkan dari data
        if (data && typeof data === 'object' && 'message' in data) {
          message = data.message;
          const { message: _, ...rest } = data;
          responseData = Object.keys(rest).length > 0 ? rest : null;
        }

        return {
          Metadata: { code: statusCode, message },
          Data: responseData,
        };
      }),
    );
  }
}
