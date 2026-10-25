import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user';
import { COOKIE_NAMES } from './auth.constants';
import { clearSessionCookies, setSessionCookies } from './auth.cookies';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas';
import {
  AuthService,
  FORGOT_RESPONSE_MESSAGE,
  REGISTER_RESPONSE_MESSAGE,
} from './auth.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.types';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registro público; crea solo cuentas CUSTOMER' })
  async register(
    @Body(new JoiValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<{ message: string }> {
    await this.authService.register(body);
    return { message: REGISTER_RESPONSE_MESSAGE };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y emite cookies de sesión' })
  async login(
    @Body(new JoiValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(body);
    setSessionCookies(response, session, this.config);
    return { user: session.user };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rota el refresh token y renueva la sesión' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.refresh(this.refreshCookie(request));
    setSessionCookies(response, session, this.config);
    return { user: session.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cierra la sesión actual y borra las cookies' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.refreshCookie(request));
    clearSessionCookies(response, this.config);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicita un enlace de recuperación (respuesta genérica)',
  })
  async forgotPassword(
    @Body(new JoiValidationPipe(forgotPasswordSchema))
    body: ForgotPasswordInput,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(body);
    return { message: FORGOT_RESPONSE_MESSAGE };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Restablece la contraseña con un token de un solo uso',
  })
  async resetPassword(
    @Body(new JoiValidationPipe(resetPasswordSchema))
    body: ResetPasswordInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.resetPassword(body);
    clearSessionCookies(response, this.config);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 5 * 60_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambia la contraseña y revoca todas las sesiones' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new JoiValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(user.id, body);
    clearSessionCookies(response, this.config);
  }

  private refreshCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_NAMES.refreshToken];
  }
}
