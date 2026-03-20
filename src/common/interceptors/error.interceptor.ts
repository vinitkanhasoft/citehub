import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const now = Date.now();

    return next.handle().pipe(
      catchError((error) => {
        const duration = Date.now() - now;
        
        this.logger.error(
          `${method} ${url} - ${ip} - ${userAgent} - ${duration}ms - ERROR: ${error.message}`,
          error.stack,
        );

        return throwError(() => error);
      }),
    );
  }
}
