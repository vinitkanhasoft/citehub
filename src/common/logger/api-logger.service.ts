import { Injectable, LoggerService, LogLevel, Logger } from '@nestjs/common';

@Injectable()
export class ApiLoggerService implements LoggerService {
  private readonly logger = new Logger('API');

  log(message: any, context?: string) {
    this.logger.log(message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, context);
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, context);
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, context);
  }

  setLogLevels(levels: LogLevel[]) {
    // Logger doesn't have setLogLevels method in this version
    // This method is kept for interface compatibility
  }
}
