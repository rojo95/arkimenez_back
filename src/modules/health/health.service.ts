import { HttpStatus, Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';

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
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.DATABASE_UNAVAILABLE,
        'La base de datos no está disponible',
      );
    }

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
