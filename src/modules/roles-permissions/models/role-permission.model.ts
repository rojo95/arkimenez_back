import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface RolePermissionAttributes {
  roleId: string;
  permissionId: string;
}

@Table({
  tableName: 'role_permissions',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class RolePermission extends Model<
  RolePermissionAttributes,
  RolePermissionAttributes
> {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare roleId: string;

  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare permissionId: string;
}
