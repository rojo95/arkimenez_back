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

export interface CategoryTranslationAttributes {
  id: string;
  categoryId: string;
  locale: string;
  name: string;
  slug: string;
  description: string | null;
}

export type CategoryTranslationCreationAttributes = Optional<
  CategoryTranslationAttributes,
  'id' | 'description'
>;

@Table({
  tableName: 'category_translations',
  underscored: true,
  timestamps: true,
})
export class CategoryTranslation extends Model<
  CategoryTranslationAttributes,
  CategoryTranslationCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare categoryId: string;

  @Column({ type: DataType.STRING(5), allowNull: false })
  declare locale: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare slug: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;
}
