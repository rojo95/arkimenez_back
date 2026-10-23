/**
 * Genera un slug estable a partir de un nombre. No usa dependencias externas:
 * normaliza diacríticos, pasa a minúsculas y separa por guiones.
 */
export function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized.length > 0 ? normalized.slice(0, 180) : 'item';
}
