/** Normaliza un correo para almacenarlo y compararlo sin distinguir mayúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
