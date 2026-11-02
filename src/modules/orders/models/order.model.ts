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

export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID';

export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

export interface OrderAttributes {
  id: string;
  publicNumber: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  shippingAddress: ShippingAddressSnapshot;
  idempotencyKey: string;
}

export type OrderCreationAttributes = Optional<
  OrderAttributes,
  'id' | 'status' | 'paymentStatus' | 'shippingMinor'
>;

@Table({
  tableName: 'orders',
  underscored: true,
  timestamps: true,
})
export class Order extends Model<OrderAttributes, OrderCreationAttributes> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING(32), allowNull: false, unique: true })
  declare publicNumber: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({
    type: DataType.STRING(32),
    allowNull: false,
    defaultValue: 'PENDING_CONFIRMATION',
  })
  declare status: OrderStatus;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'UNPAID',
  })
  declare paymentStatus: PaymentStatus;

  @Column({ type: DataType.STRING(3), allowNull: false })
  declare currency: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare subtotalMinor: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare shippingMinor: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare totalMinor: number;

  @Column({ type: DataType.JSON, allowNull: false })
  declare shippingAddress: ShippingAddressSnapshot;

  @Column({ type: DataType.UUID, allowNull: false })
  declare idempotencyKey: string;
}
