import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getTraceId } from '../context/request-context';
import { AppException } from './app-exception';
import type { ErrorDetail } from './app-exception';
import {
  ErrorCode,
  HTTP_STATUS_TO_ERROR_CODE,
  type ErrorCodeValue,
} from './error-codes';

interface ErrorBody {
  error: {
    code: ErrorCodeValue;
    message: string;
    details: ErrorDetail[];
    traceId: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = getTraceId() ?? 'unknown';

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCodeValue = ErrorCode.INTERNAL_ERROR;
    let message = 'Error interno del servidor';
    let details: ErrorDetail[] = [];

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        if (typeof record.message === 'string') {
          message = record.message;
        }
        if (Array.isArray(record.details)) {
          details = record.details as ErrorDetail[];
        }
      }
    } else {
      this.logger.error(
        `Error no controlado en ${request.method} ${request.url} (traceId=${traceId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = { error: { code, message, details, traceId } };
    response.status(status).json(body);
  }
}
