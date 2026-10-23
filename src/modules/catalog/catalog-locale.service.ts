import { Injectable } from '@nestjs/common';
import { resolveLocale } from '../../shared/i18n/locale';
import { StoreSettingsService } from '../store-settings/store-settings.service';

export interface LocaleContext {
  locale: string;
  defaultLocale: string;
  activeLocales: string[];
}

@Injectable()
export class CatalogLocaleService {
  constructor(private readonly storeSettings: StoreSettingsService) {}

  async resolve(
    requested: string | undefined,
    acceptLanguage: string | undefined,
  ): Promise<LocaleContext> {
    const settings = await this.storeSettings.getAll();
    const defaultLocale = settings['i18n.locale.default'] ?? 'es';
    const activeLocales = Object.entries(settings)
      .filter(([key, value]) => {
        return (
          key.startsWith('i18n.locale.') &&
          key.endsWith('.active') &&
          value === 'true'
        );
      })
      .map(([key]) => key.slice('i18n.locale.'.length, -'.active'.length));

    return {
      locale: resolveLocale(
        requested,
        acceptLanguage,
        activeLocales.length > 0 ? activeLocales : [defaultLocale],
        defaultLocale,
      ),
      defaultLocale,
      activeLocales,
    };
  }
}
