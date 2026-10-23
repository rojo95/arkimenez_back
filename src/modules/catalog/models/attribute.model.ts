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

export interface AttributeAttributes {
  id: string;
  code: string;
  isVariantAxis: boolean;
}

export type AttributeCreationAttributes = Optional<
  AttributeAttributes,
  'id' | 'isVariantAxis'
>;

@Table({
  tableName: 'attributes',
  underscored: true,
  timestamps: true,
})
export class Attribute extends Model<
  AttributeAttributes,
  AttributeCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isVariantAxis: boolean;
}
