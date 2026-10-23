import { randomUUID } from 'node:crypto';
import type { Optional } from 'sequelize';
import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface ProductTranslationAttributes {
  id: string;
  productId: string;
  locale: string;
  name: string;
  slug: string;
  description: string | null;
}

export type ProductTranslationCreationAttributes = Optional<
  ProductTranslationAttributes,
  'id' | 'description'
>;

@Table({
  tableName: 'product_translations',
  underscored: true,
  timestamps: true,
})
export class ProductTranslation extends Model<
  ProductTranslationAttributes,
  ProductTranslationCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare productId: string;

  @Column({ type: DataType.STRING(5), allowNull: false })
  declare locale: string;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(180), allowNull: false })
  declare slug: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;
}
