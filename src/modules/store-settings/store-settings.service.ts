import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { StoreSetting } from './models/store-setting.model';

/**
 * Acceso a la configuración de la tienda (clave-valor).
 *
 * Cada clave es un dato atómico (p. ej. `i18n.locale.en.active`); no se guardan
 * colecciones en una sola fila.
 */
@Injectable()
export class StoreSettingsService {
  constructor(
    @InjectModel(StoreSetting)
    private readonly storeSettingModel: typeof StoreSetting,
  ) {}

  async get(key: string): Promise<string | undefined> {
    const row = await this.storeSettingModel.findByPk(key);
    return row?.value;
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.storeSettingModel.findAll();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) {
      return {};
    }

    const rows = await this.storeSettingModel.findAll({
      where: { key: { [Op.in]: keys } },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  /** Crea la clave solo si no existe; nunca sobrescribe un valor existente. */
  async setIfAbsent(key: string, value: string): Promise<void> {
    await this.storeSettingModel.findOrCreate({
      where: { key },
      defaults: { key, value },
    });
  }
}
