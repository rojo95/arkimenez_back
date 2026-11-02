import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { checkoutSchema, validateCartSchema } from './checkout.schemas';
import { CheckoutService } from './checkout.service';
import type { CheckoutInput } from './checkout.types';

@ApiTags('checkout')
@Controller()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Public()
  @Post('cart/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valida un carrito de invitado y calcula totales' })
  validateCart(
    @Body(new JoiValidationPipe(validateCartSchema))
    body: {
      items: Array<{ variantId: string; quantity: number }>;
    },
  ) {
    return this.checkoutService.validateCart(body);
  }

  @ApiBearerAuth()
  @Post('checkout')
  @ApiOperation({
    summary: 'Crea un pedido a partir del carrito (idempotente)',
  })
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new JoiValidationPipe(checkoutSchema)) body: CheckoutInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
        'Falta Idempotency-Key',
      );
    }
    const result = await this.checkoutService.checkout(
      user.id,
      body,
      idempotencyKey,
    );
    // RF-CHK-004: repetir la Idempotency-Key devuelve el pedido ya creado.
    // 201 solo la primera vez; el replay no crea nada y responde 200.
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }
}
