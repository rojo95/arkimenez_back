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

export interface CategoryAttributes {
  id: string;
  isActive: boolean;
  imageStorageKey: string | null;
}

export type CategoryCreationAttributes = Optional<
  CategoryAttributes,
  'id' | 'isActive' | 'imageStorageKey'
>;

@Table({
  tableName: 'categories',
  underscored: true,
  timestamps: true,
})
export class Category extends Model<
  CategoryAttributes,
  CategoryCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare imageStorageKey: string | null;
}
