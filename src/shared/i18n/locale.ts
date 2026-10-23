export function parseAcceptLanguage(header?: string): string | undefined {
  if (!header) {
    return undefined;
  }

  const candidate = header
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.endsWith(';q=0'))
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .find((part) => Boolean(part && part !== '*'));

  return candidate;
}

/**
 * Resuelve el idioma de una petición pública (ADR-0003 / RF-I18N-003).
 *
 * Prioridad: `locale` explícito → `Accept-Language` → idioma por defecto.
 * Si el candidato no está activo, se usa el idioma por defecto.
 */
export function resolveLocale(
  requested: string | undefined,
  acceptLanguage: string | undefined,
  activeLocales: string[],
  defaultLocale: string,
): string {
  const active = activeLocales.map((locale) => locale.toLowerCase());
  const fallback = defaultLocale.toLowerCase();
  const candidate =
    requested?.trim().toLowerCase() || parseAcceptLanguage(acceptLanguage);

  if (!candidate) {
    return fallback;
  }

  if (active.includes(candidate)) {
    return candidate;
  }

  const primary = candidate.split('-')[0];
  if (primary && active.includes(primary)) {
    return primary;
  }

  return fallback;
}

/** Fallback por campo a la traducción por defecto (RN-I18N-02). */
export function pickTranslation<T extends { locale: string }>(
  translations: T[],
  locale: string,
  defaultLocale: string,
): T | undefined {
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === defaultLocale) ??
    translations[0]
  );
}
