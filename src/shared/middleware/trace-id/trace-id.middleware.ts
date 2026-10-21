import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../../context/request-context';

const TRACE_ID_HEADER = 'x-trace-id';
const MAX_TRACE_ID_LENGTH = 64;

/**
 * Asigna un `traceId` a cada petición (o reutiliza el entrante), lo expone en
 * la respuesta y lo guarda en el contexto asíncrono para el resto del ciclo.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[TRACE_ID_HEADER];
    const traceId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim().slice(0, MAX_TRACE_ID_LENGTH)
        : randomUUID();

    res.setHeader(TRACE_ID_HEADER, traceId);
    requestContext.run({ traceId }, () => next());
  }
}
