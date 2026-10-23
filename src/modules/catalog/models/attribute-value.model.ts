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

export interface AttributeValueAttributes {
  id: string;
  attributeId: string;
  code: string;
}

export type AttributeValueCreationAttributes = Optional<
  AttributeValueAttributes,
  'id'
>;

@Table({
  tableName: 'attribute_values',
  underscored: true,
  timestamps: true,
})
export class AttributeValue extends Model<
  AttributeValueAttributes,
  AttributeValueCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare attributeId: string;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare code: string;
}
