import type { NextFunction, Request, Response } from 'express';
import { getTraceId } from '../../context/request-context';
import { TraceIdMiddleware } from './trace-id.middleware';

describe('TraceIdMiddleware', () => {
  const middleware = new TraceIdMiddleware();

  function createResponse(): Response {
    return { setHeader: jest.fn() } as unknown as Response;
  }

  it('reutiliza el traceId entrante', () => {
    const req = {
      headers: { 'x-trace-id': 'trace-123' },
    } as unknown as Request;
    const res = createResponse();
    let traceIdInContext: string | undefined;
    const next = (() => {
      traceIdInContext = getTraceId();
    }) as NextFunction;

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', 'trace-123');
    expect(traceIdInContext).toBe('trace-123');
  });

  it('genera un traceId cuando no viene en la petición', () => {
    const req = { headers: {} } as unknown as Request;
    const res = createResponse();
    let traceIdInContext: string | undefined;
    const next = (() => {
      traceIdInContext = getTraceId();
    }) as NextFunction;

    middleware.use(req, res, next);

    expect(traceIdInContext).toBeDefined();
    expect(traceIdInContext?.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', traceIdInContext);
  });
});
