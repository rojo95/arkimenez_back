import { timingSafeEqual } from 'node:crypto';

/**
 * Comparación en tiempo constante de dos cadenas.
 *
 * `timingSafeEqual` exige buffers de la misma longitud; si difieren, no hay
 * coincidencia posible y se devuelve `false` sin comparar.
 */
export function secureEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
