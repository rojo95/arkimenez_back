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

export interface AttributeValueTranslationAttributes {
  id: string;
  attributeValueId: string;
  locale: string;
  name: string;
}

export type AttributeValueTranslationCreationAttributes = Optional<
  AttributeValueTranslationAttributes,
  'id'
>;

@Table({
  tableName: 'attribute_value_translations',
  underscored: true,
  timestamps: true,
})
export class AttributeValueTranslation extends Model<
  AttributeValueTranslationAttributes,
  AttributeValueTranslationCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare attributeValueId: string;

  @Column({ type: DataType.STRING(5), allowNull: false })
  declare locale: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare name: string;
}
