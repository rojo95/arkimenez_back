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

export interface RefreshTokenAttributes {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export type RefreshTokenCreationAttributes = Optional<
  RefreshTokenAttributes,
  'id' | 'revokedAt' | 'replacedBy'
>;

@Table({
  tableName: 'refresh_tokens',
  underscored: true,
  timestamps: true,
})
export class RefreshToken extends Model<
  RefreshTokenAttributes,
  RefreshTokenCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare familyId: string;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare revokedAt: Date | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare replacedBy: string | null;
}
