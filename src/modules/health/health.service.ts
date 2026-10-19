import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly sequelize: Sequelize) {}

  /**
   * Comprueba la conexión a la base de datos (RF de Fase 1).
   * Responde 503 con el formato de error único (SDD §9) si no está disponible.
   */
  async check(): Promise<HealthStatus> {
    try {
      await this.sequelize.authenticate();
    } catch {
      throw new ServiceUnavailableException({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'La base de datos no está disponible',
          details: [],
          traceId: 'health',
        },
      });
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
