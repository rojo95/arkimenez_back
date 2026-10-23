import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface UserRoleAttributes {
  userId: string;
  roleId: string;
}

@Table({
  tableName: 'user_roles',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class UserRole extends Model<UserRoleAttributes, UserRoleAttributes> {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare roleId: string;
}
