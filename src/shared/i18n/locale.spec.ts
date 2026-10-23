import { parseAcceptLanguage, pickTranslation, resolveLocale } from './locale';

describe('locale helpers', () => {
  it('extrae el primer idioma de Accept-Language', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9,es;q=0.8')).toBe('en-us');
    expect(parseAcceptLanguage(undefined)).toBeUndefined();
  });

  it('prioriza el parámetro locale', () => {
    expect(resolveLocale('en', 'es-ES', ['es', 'en'], 'es')).toBe('en');
  });

  it('usa Accept-Language si no hay parámetro', () => {
    expect(resolveLocale(undefined, 'en-GB,en;q=0.9', ['es', 'en'], 'es')).toBe(
      'en',
    );
  });

  it('cae al idioma por defecto si el pedido no está activo', () => {
    expect(resolveLocale('fr', 'fr-FR', ['es', 'en'], 'es')).toBe('es');
  });

  it('acepta el idioma primario de una variante regional', () => {
    expect(resolveLocale('es-MX', undefined, ['es', 'en'], 'en')).toBe('es');
  });

  it('hace fallback por campo a la traducción por defecto', () => {
    const translations = [
      { locale: 'es', name: 'Camisa' },
      { locale: 'en', name: 'Shirt' },
    ];
    expect(pickTranslation(translations, 'en', 'es')?.name).toBe('Shirt');
    expect(pickTranslation(translations, 'fr', 'es')?.name).toBe('Camisa');
  });
});
