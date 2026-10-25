const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Convierte una duración simple (`15m`, `900s`, `1h`, `30d`) a milisegundos.
 * Se usa para alinear la caducidad de las cookies con los tokens.
 */
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Duración no válida: ${value}`);
  }

  return Number(match[1]) * UNIT_MS[match[2]];
}
