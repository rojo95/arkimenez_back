import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InventoryModule } from '../inventory/inventory.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogLocaleService } from './catalog-locale.service';
import { CatalogPublicController } from './catalog-public.controller';
import { CatalogService } from './catalog.service';
import { ImageService } from './image.service';
import { AttributeTranslation } from './models/attribute-translation.model';
import { AttributeValueTranslation } from './models/attribute-value-translation.model';
import { AttributeValue } from './models/attribute-value.model';
import { Attribute } from './models/attribute.model';
import { CategoryTranslation } from './models/category-translation.model';
import { Category } from './models/category.model';
import { ProductCategory } from './models/product-category.model';
import { ProductImage } from './models/product-image.model';
import { ProductTranslation } from './models/product-translation.model';
import { ProductVariant } from './models/product-variant.model';
import { Product } from './models/product.model';
import { VariantOptionValue } from './models/variant-option-value.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Product,
      ProductTranslation,
      ProductImage,
      ProductCategory,
      ProductVariant,
      VariantOptionValue,
      Category,
      CategoryTranslation,
      Attribute,
      AttributeTranslation,
      AttributeValue,
      AttributeValueTranslation,
    ]),
    InventoryModule,
    StoreSettingsModule,
  ],
  controllers: [CatalogPublicController, CatalogAdminController],
  providers: [CatalogService, CatalogLocaleService, ImageService],
  exports: [CatalogService],
})
export class CatalogModule {}
