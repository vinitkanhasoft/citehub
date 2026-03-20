import { Module } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { ApiLoggerService } from './logger/api-logger.service';

@Module({
  providers: [
    HttpExceptionFilter,
    ErrorInterceptor,
    LoggingInterceptor,
    ResponseInterceptor,
    ApiLoggerService,
  ],
  exports: [
    ApiLoggerService,
    HttpExceptionFilter,
    ErrorInterceptor,
    LoggingInterceptor,
    ResponseInterceptor,
  ],
})
export class CommonModule {}
