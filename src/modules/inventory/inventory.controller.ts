import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';
import {
  adjustStockSchema,
  inventoryListQuerySchema,
  movementListQuerySchema,
  variantParamSchema,
} from './inventory.schemas';
import { InventoryService } from './inventory.service';
import type { AdjustStockInput } from './inventory.service';

interface ListQuery {
  page: number;
  pageSize: number;
}

@ApiTags('admin/inventory')
@ApiBearerAuth()
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Lista el stock por variante' })
  @UsePipes(new JoiValidationPipe(inventoryListQuerySchema))
  list(@Query() query: ListQuery) {
    return this.inventoryService.list(query.page, query.pageSize);
  }

  @Get(':variantId/movements')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Lista los movimientos de stock de una variante' })
  movements(
    @Param(new JoiValidationPipe(variantParamSchema))
    params: { variantId: string },
    @Query(new JoiValidationPipe(movementListQuerySchema)) query: ListQuery,
  ) {
    return this.inventoryService.listMovements(
      params.variantId,
      query.page,
      query.pageSize,
    );
  }

  @Patch(':variantId')
  @RequirePermissions('inventory:adjust')
  @ApiOperation({ summary: 'Ajusta el stock con motivo obligatorio' })
  adjust(
    @Param(new JoiValidationPipe(variantParamSchema))
    params: { variantId: string },
    @Body(new JoiValidationPipe(adjustStockSchema)) body: AdjustStockInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjust(params.variantId, body, user.id);
  }
}
