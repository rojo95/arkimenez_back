import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditModule } from '../audit/audit.module';
import { Product } from '../catalog/models/product.model';
import { ProductTranslation } from '../catalog/models/product-translation.model';
import { ProductVariant } from '../catalog/models/product-variant.model';
import { VariantOptionValue } from '../catalog/models/variant-option-value.model';
import { Attribute } from '../catalog/models/attribute.model';
import { AttributeValue } from '../catalog/models/attribute-value.model';
import { AttributeValueTranslation } from '../catalog/models/attribute-value-translation.model';
import { InventoryItem } from '../inventory/models/inventory-item.model';
import { StockMovement } from '../inventory/models/stock-movement.model';
import { Address } from '../users/models/address.model';
import { Order } from '../orders/models/order.model';
import { OrderItem } from '../orders/models/order-item.model';
import { OrderStatusHistory } from '../orders/models/order-status-history.model';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Product,
      ProductTranslation,
      ProductVariant,
      VariantOptionValue,
      Attribute,
      AttributeValue,
      AttributeValueTranslation,
      InventoryItem,
      StockMovement,
      Address,
      Order,
      OrderItem,
      OrderStatusHistory,
    ]),
    AuditModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
