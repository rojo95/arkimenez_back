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

export interface ProductImageAttributes {
  id: string;
  productId: string;
  storageKey: string;
  mime: string;
  sizeBytes: number;
  alt: string | null;
  position: number;
}

export type ProductImageCreationAttributes = Optional<
  ProductImageAttributes,
  'id' | 'alt' | 'position'
>;

@Table({
  tableName: 'product_images',
  underscored: true,
  timestamps: true,
})
export class ProductImage extends Model<
  ProductImageAttributes,
  ProductImageCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare productId: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare storageKey: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare mime: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare sizeBytes: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare alt: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare position: number;
}
