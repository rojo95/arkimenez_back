import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/** Envío de correos transaccionales. Nunca registra tokens ni contraseñas. */
@Injectable()
export class AuthMailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from =
      config.get<string>('MAIL_FROM') ?? 'no-reply@tiendalujosa.local';

    if (config.get<string>('NODE_ENV') === 'test') {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    const user = config.get<string>('MAIL_USER');
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('MAIL_HOST') ?? 'localhost',
      port: config.get<number>('MAIL_PORT') ?? 1025,
      secure: false,
      auth:
        user && config.get<string>('MAIL_PASSWORD')
          ? {
              user,
              pass: config.get<string>('MAIL_PASSWORD'),
            }
          : undefined,
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Recuperación de contraseña',
      text: `Para restablecer tu contraseña abre este enlace (caduca pronto): ${resetUrl}\n\nSi no lo solicitaste, ignora este correo.`,
      html: `<p>Para restablecer tu contraseña abre este enlace (caduca pronto):</p><p><a href="${resetUrl}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este correo.</p>`,
    });
  }
}
