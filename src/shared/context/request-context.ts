import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  traceId: string;
}

/**
 * Contexto por petición. Permite recuperar el `traceId` en cualquier capa
 * (filtros, servicios, repositorios) sin pasarlo por parámetro.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getTraceId(): string | undefined {
  return requestContext.getStore()?.traceId;
}
