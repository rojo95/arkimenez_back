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

export interface PasswordResetTokenAttributes {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export type PasswordResetTokenCreationAttributes = Optional<
  PasswordResetTokenAttributes,
  'id' | 'usedAt'
>;

@Table({
  tableName: 'password_reset_tokens',
  underscored: true,
  timestamps: true,
})
export class PasswordResetToken extends Model<
  PasswordResetTokenAttributes,
  PasswordResetTokenCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare usedAt: Date | null;
}
