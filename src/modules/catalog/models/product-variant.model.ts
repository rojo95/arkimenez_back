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

export interface ProductVariantAttributes {
  id: string;
  productId: string;
  sku: string;
  priceMinor: number | null;
  isDefault: boolean;
  isActive: boolean;
  combinationKey: string;
}

export type ProductVariantCreationAttributes = Optional<
  ProductVariantAttributes,
  'id' | 'priceMinor' | 'isDefault' | 'isActive' | 'combinationKey'
>;

@Table({
  tableName: 'product_variants',
  underscored: true,
  timestamps: true,
})
export class ProductVariant extends Model<
  ProductVariantAttributes,
  ProductVariantCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare productId: string;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare sku: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare priceMinor: number | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isDefault: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare combinationKey: string;
}
