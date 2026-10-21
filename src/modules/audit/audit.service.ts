import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLog } from './models/audit-log.model';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registro de auditoría de acciones sensibles (cambios de rol, estado de
 * cuenta, ajustes de inventario…). Nunca guarda credenciales ni tokens.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog) private readonly auditLogModel: typeof AuditLog,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.auditLogModel.create({
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  }
}
