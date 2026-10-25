import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';
import {
  addressSchema,
  updateProfileSchema,
  uuidParamSchema,
} from './users.schemas';
import { UsersService } from './users.service';
import type { AddressInput } from './users.types';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Devuelve el perfil del usuario autenticado' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza el nombre del perfil propio' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new JoiValidationPipe(updateProfileSchema)) body: { name: string },
  ) {
    return this.usersService.updateProfile(user.id, body.name);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Lista las direcciones del usuario autenticado' })
  listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listAddresses(user.id);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Crea una dirección propia' })
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new JoiValidationPipe(addressSchema)) body: AddressInput,
  ) {
    return this.usersService.createAddress(user.id, body);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Actualiza una dirección propia' })
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new JoiValidationPipe(addressSchema)) body: AddressInput,
  ) {
    return this.usersService.updateAddress(user.id, params.id, body);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una dirección propia' })
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
  ): Promise<void> {
    await this.usersService.deleteAddress(user.id, params.id);
  }
}
