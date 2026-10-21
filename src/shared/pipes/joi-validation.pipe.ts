import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import type { ObjectSchema } from 'joi';
import { AppException } from '../errors/app-exception';
import type { ErrorDetail } from '../errors/app-exception';
import { ErrorCode } from '../errors/error-codes';

/**
 * Valida cuerpo, query o params con un esquema Joi.
 *
 * Rechaza campos desconocidos (sin asignación masiva) y no elimina los que no
 * estén en el esquema: si el cliente manda algo de más, la petición falla.
 */
@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private readonly schema: ObjectSchema) {}

  transform(value: unknown): unknown {
    const { error, value: validated } = this.schema.validate(value, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: false,
      convert: true,
    });

    if (error) {
      const details: ErrorDetail[] = error.details.map((detail) => ({
        field: detail.path.join('.') || '_',
        issue: detail.message,
      }));

      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Datos de entrada inválidos',
        details,
      );
    }

    return validated;
  }
}
