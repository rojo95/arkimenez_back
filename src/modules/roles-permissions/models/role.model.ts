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

export interface RoleAttributes {
  id: string;
  code: string;
  name: string;
}

export type RoleCreationAttributes = Optional<RoleAttributes, 'id'>;

@Table({
  tableName: 'roles',
  underscored: true,
  timestamps: true,
})
export class Role extends Model<RoleAttributes, RoleCreationAttributes> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING(40), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare name: string;
}
