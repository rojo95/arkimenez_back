import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCodeValue } from './error-codes';

export interface ErrorDetail {
  field: string;
  issue: string;
}

/**
 * Excepción de negocio con el formato de error único de la API.
 *
 * Transporta `code`, `message` y `details`; el filtro global añade el `traceId`.
 */
export class AppException extends HttpException {
  readonly code: ErrorCodeValue;
  readonly details: ErrorDetail[];

  constructor(
    status: HttpStatus,
    code: ErrorCodeValue,
    message: string,
    details: ErrorDetail[] = [],
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}
