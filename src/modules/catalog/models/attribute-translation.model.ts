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

export interface AttributeTranslationAttributes {
  id: string;
  attributeId: string;
  locale: string;
  name: string;
}

export type AttributeTranslationCreationAttributes = Optional<
  AttributeTranslationAttributes,
  'id'
>;

@Table({
  tableName: 'attribute_translations',
  underscored: true,
  timestamps: true,
})
export class AttributeTranslation extends Model<
  AttributeTranslationAttributes,
  AttributeTranslationCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare attributeId: string;

  @Column({ type: DataType.STRING(5), allowNull: false })
  declare locale: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare name: string;
}
