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

export type StockMovementReason =
  'SALE' | 'CANCEL_RESTOCK' | 'ADJUSTMENT' | 'INITIAL';

export interface StockMovementAttributes {
  id: string;
  variantId: string;
  delta: number;
  reason: StockMovementReason;
  orderId: string | null;
  actorId: string | null;
  note: string | null;
}

export type StockMovementCreationAttributes = Optional<
  StockMovementAttributes,
  'id' | 'orderId' | 'actorId' | 'note'
>;

@Table({
  tableName: 'stock_movements',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class StockMovement extends Model<
  StockMovementAttributes,
  StockMovementCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare variantId: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare delta: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare reason: StockMovementReason;

  @Column({ type: DataType.UUID, allowNull: true })
  declare orderId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare actorId: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare note: string | null;
}
