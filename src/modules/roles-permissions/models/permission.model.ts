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

export interface PermissionAttributes {
  id: string;
  code: string;
  description: string;
}

export type PermissionCreationAttributes = Optional<PermissionAttributes, 'id'>;

@Table({
  tableName: 'permissions',
  underscored: true,
  timestamps: true,
})
export class Permission extends Model<
  PermissionAttributes,
  PermissionCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare description: string;
}
