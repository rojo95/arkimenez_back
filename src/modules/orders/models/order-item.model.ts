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

export interface OrderItemAttributes {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  sku: string;
  options: string | null;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

export type OrderItemCreationAttributes = Optional<
  OrderItemAttributes,
  'id' | 'productId' | 'variantId' | 'options'
>;

@Table({
  tableName: 'order_items',
  underscored: true,
  timestamps: true,
})
export class OrderItem extends Model<
  OrderItemAttributes,
  OrderItemCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare orderId: string;

  @Column({ type: DataType.UUID, allowNull: true })
  declare productId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare variantId: string | null;

  @Column({ type: DataType.STRING(240), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare sku: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare options: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare unitPriceMinor: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare quantity: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare lineTotalMinor: number;
}
