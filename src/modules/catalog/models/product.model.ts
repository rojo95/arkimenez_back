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

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ProductType = 'SIMPLE' | 'VARIABLE';

export interface ProductAttributes {
  id: string;
  status: ProductStatus;
  type: ProductType;
  basePriceMinor: number;
  deletedAt: Date | null;
}

export type ProductCreationAttributes = Optional<
  ProductAttributes,
  'id' | 'status' | 'deletedAt'
>;

@Table({
  tableName: 'products',
  underscored: true,
  timestamps: true,
})
export class Product extends Model<
  ProductAttributes,
  ProductCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({
    type: DataType.STRING(12),
    allowNull: false,
    defaultValue: 'DRAFT',
  })
  declare status: ProductStatus;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    defaultValue: 'SIMPLE',
  })
  declare type: ProductType;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare basePriceMinor: number;

  @Column({ type: DataType.DATE, allowNull: true })
  declare deletedAt: Date | null;
}
