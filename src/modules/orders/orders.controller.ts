import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';
import {
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} from './orders.schemas';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los pedidos del cliente autenticado' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new JoiValidationPipe(listOrdersQuerySchema))
    query: { page: number; pageSize: number },
  ) {
    return this.ordersService.listForUser(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un pedido propio' })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new JoiValidationPipe(orderIdParamSchema)) params: { id: string },
  ) {
    return this.ordersService.getOrderForUser(user.id, params.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancela un pedido en confirmación pendiente' })
  cancelMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new JoiValidationPipe(orderIdParamSchema)) params: { id: string },
  ) {
    return this.ordersService.cancelByCustomer(user.id, params.id);
  }
}

@ApiTags('admin/orders')
@ApiBearerAuth()
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('order:read')
  @ApiOperation({ summary: 'Lista todos los pedidos' })
  listAll(
    @Query(new JoiValidationPipe(listOrdersQuerySchema))
    query: {
      page: number;
      pageSize: number;
    },
  ) {
    return this.ordersService.listAll(query);
  }

  @Get(':id')
  @RequirePermissions('order:read')
  @ApiOperation({ summary: 'Obtiene un pedido por id' })
  getOne(
    @Param(new JoiValidationPipe(orderIdParamSchema)) params: { id: string },
  ) {
    return this.ordersService.getOrder(params.id);
  }

  @Patch(':id/status')
  @RequirePermissions('order:update_status')
  @ApiOperation({ summary: 'Cambia el estado de un pedido' })
  updateStatus(
    @Param(new JoiValidationPipe(orderIdParamSchema)) params: { id: string },
    @Body(new JoiValidationPipe(updateOrderStatusSchema))
    body: { status: string; note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(
      params.id,
      body.status,
      user.id,
      body.note,
    );
  }
}
