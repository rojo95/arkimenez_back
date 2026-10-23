import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditModule } from '../audit/audit.module';
import { ProductVariant } from '../catalog/models/product-variant.model';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './models/inventory-item.model';
import { StockMovement } from './models/stock-movement.model';

@Module({
  imports: [
    SequelizeModule.forFeature([InventoryItem, StockMovement, ProductVariant]),
    AuditModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
