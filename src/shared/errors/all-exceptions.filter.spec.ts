import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppException } from './app-exception';
import { ErrorCode } from './error-codes';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let status: jest.Mock;
  let json: jest.Mock;

  function buildHost(): ArgumentsHost {
    status = jest.fn().mockReturnThis();
    json = jest.fn().mockReturnThis();
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ method: 'GET', url: '/api/v1/test' }),
      }),
    } as unknown as ArgumentsHost;
  }

  it('serializa AppException con code, details y traceId', () => {
    filter.catch(
      new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Datos inválidos',
        [{ field: 'email', issue: 'obligatorio' }],
      ),
      buildHost(),
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ field: 'email', issue: 'obligatorio' }],
        traceId: 'unknown',
      },
    });
  });

  it('traduce HttpException al catálogo de códigos', () => {
    filter.catch(new BadRequestException('petición mal formada'), buildHost());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
  });

  it('oculta los detalles internos de un error inesperado', () => {
    filter.catch(new Error('secreto de base de datos'), buildHost());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: [],
        traceId: 'unknown',
      },
    });
  });
});
