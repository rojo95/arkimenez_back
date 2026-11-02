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

export interface OrderStatusHistoryAttributes {
  id: string;
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  note: string | null;
}

export type OrderStatusHistoryCreationAttributes = Optional<
  OrderStatusHistoryAttributes,
  'id' | 'fromStatus' | 'actorId' | 'note'
>;

@Table({
  tableName: 'order_status_history',
  underscored: true,
  timestamps: true,
})
export class OrderStatusHistory extends Model<
  OrderStatusHistoryAttributes,
  OrderStatusHistoryCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare orderId: string;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare fromStatus: string | null;

  @Column({ type: DataType.STRING(32), allowNull: false })
  declare toStatus: string;

  @Column({ type: DataType.UUID, allowNull: true })
  declare actorId: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare note: string | null;
}
