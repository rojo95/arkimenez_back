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

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserAttributes {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  isStaff: boolean;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'status' | 'isStaff'
>;

@Table({
  tableName: 'users',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(320), allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare passwordHash: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: 'ACTIVE',
  })
  declare status: UserStatus;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isStaff: boolean;
}
