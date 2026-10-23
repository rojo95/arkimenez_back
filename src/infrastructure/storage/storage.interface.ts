export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

/**
 * Contrato de almacenamiento de imágenes (ADR-0004).
 *
 * `key` es siempre una clave generada por el servidor, nunca una ruta del
 * usuario. El proveedor decide cómo materializarla.
 */
export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
