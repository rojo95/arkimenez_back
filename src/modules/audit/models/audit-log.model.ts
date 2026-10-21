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

export interface AuditLogAttributes {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
}

export type AuditLogCreationAttributes = Optional<
  AuditLogAttributes,
  'id' | 'actorId' | 'entityId' | 'metadata'
>;

@Table({
  tableName: 'audit_logs',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
})
export class AuditLog extends Model<
  AuditLogAttributes,
  AuditLogCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: true })
  declare actorId: string | null;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare action: string;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare entity: string;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare entityId: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare metadata: string | null;
}
