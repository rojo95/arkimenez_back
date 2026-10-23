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

export interface InventoryItemAttributes {
  id: string;
  variantId: string;
  quantity: number;
  allowBackorder: boolean;
}

export type InventoryItemCreationAttributes = Optional<
  InventoryItemAttributes,
  'id' | 'quantity' | 'allowBackorder'
>;

@Table({
  tableName: 'inventory_items',
  underscored: true,
  timestamps: true,
})
export class InventoryItem extends Model<
  InventoryItemAttributes,
  InventoryItemCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false, unique: true })
  declare variantId: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare quantity: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare allowBackorder: boolean;
}
