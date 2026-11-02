import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditModule } from '../audit/audit.module';
import { InventoryItem } from '../inventory/models/inventory-item.model';
import { StockMovement } from '../inventory/models/stock-movement.model';
import { Order } from './models/order.model';
import { OrderItem } from './models/order-item.model';
import { OrderStatusHistory } from './models/order-status-history.model';
import { OrdersController, AdminOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Order,
      OrderItem,
      OrderStatusHistory,
      InventoryItem,
      StockMovement,
    ]),
    AuditModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
