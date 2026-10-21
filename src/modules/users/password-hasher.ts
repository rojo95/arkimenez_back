import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hash de contraseñas con argon2id (ADR-0002).
 *
 * `argon2` usa argon2id por defecto con parámetros seguros; se fijan
 * explícitamente para no depender del valor por defecto de la librería.
 */
@Injectable()
export class PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
