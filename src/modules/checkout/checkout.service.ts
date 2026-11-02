import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { AuditService } from '../audit/audit.service';
import { Product } from '../catalog/models/product.model';
import { ProductTranslation } from '../catalog/models/product-translation.model';
import { ProductVariant } from '../catalog/models/product-variant.model';
import { VariantOptionValue } from '../catalog/models/variant-option-value.model';
import { AttributeValue } from '../catalog/models/attribute-value.model';
import { AttributeValueTranslation } from '../catalog/models/attribute-value-translation.model';
import { Attribute } from '../catalog/models/attribute.model';
import { InventoryItem } from '../inventory/models/inventory-item.model';
import { StockMovement } from '../inventory/models/stock-movement.model';
import { Address } from '../users/models/address.model';
import { Order } from '../orders/models/order.model';
import { OrderItem } from '../orders/models/order-item.model';
import { OrderStatusHistory } from '../orders/models/order-status-history.model';
import type {
  CheckoutInput,
  ValidatedCart,
  ValidatedCartLine,
} from './checkout.types';
import type { ShippingAddressSnapshot } from '../orders/models/order.model';

interface VariantDetail {
  variant: ProductVariant;
  product: Product;
  productName: string | null;
  optionsText: string | null;
  priceMinor: number;
  stockQuantity: number;
  allowBackorder: boolean;
  isActive: boolean;
  productStatus: string;
}

@Injectable()
export class CheckoutService {
  private readonly defaultLocale: string;
  private readonly storeCurrency: string;

  constructor(
    private readonly config: ConfigService,
    private readonly sequelize: Sequelize,
    private readonly auditService: AuditService,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
    @InjectModel(ProductTranslation)
    private readonly productTranslationModel: typeof ProductTranslation,
    @InjectModel(ProductVariant)
    private readonly variantModel: typeof ProductVariant,
    @InjectModel(VariantOptionValue)
    private readonly variantOptionValueModel: typeof VariantOptionValue,
    @InjectModel(AttributeValue)
    private readonly attributeValueModel: typeof AttributeValue,
    @InjectModel(AttributeValueTranslation)
    private readonly attributeValueTranslationModel: typeof AttributeValueTranslation,
    @InjectModel(Attribute)
    private readonly attributeModel: typeof Attribute,
    @InjectModel(InventoryItem)
    private readonly inventoryItemModel: typeof InventoryItem,
    @InjectModel(StockMovement)
    private readonly stockMovementModel: typeof StockMovement,
    @InjectModel(Address)
    private readonly addressModel: typeof Address,
    @InjectModel(Order)
    private readonly orderModel: typeof Order,
    @InjectModel(OrderItem)
    private readonly orderItemModel: typeof OrderItem,
    @InjectModel(OrderStatusHistory)
    private readonly orderStatusHistoryModel: typeof OrderStatusHistory,
  ) {
    this.defaultLocale = config.get<string>('DEFAULT_LOCALE') ?? 'es';
    this.storeCurrency = config.get<string>('STORE_CURRENCY') ?? 'EUR';
  }

  async validateCart(input: {
    items: Array<{ variantId: string; quantity: number }>;
  }): Promise<ValidatedCart> {
    const details = await this.loadVariantDetails(
      input.items.map((item) => item.variantId),
    );

    const lines: ValidatedCartLine[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      const detail = details.get(item.variantId);
      if (!detail || !detail.isActive || detail.productStatus !== 'PUBLISHED') {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.PRODUCT_NOT_AVAILABLE,
          'Producto no disponible',
          [{ field: 'items', issue: 'product_not_available' }],
        );
      }

      const available =
        detail.allowBackorder || detail.stockQuantity >= item.quantity;
      const lineTotal = detail.priceMinor * item.quantity;
      subtotal += lineTotal;

      lines.push({
        variantId: item.variantId,
        productId: detail.product.id,
        sku: detail.variant.sku,
        name: detail.productName ?? detail.variant.sku,
        options: detail.optionsText,
        unitPriceMinor: detail.priceMinor,
        quantity: item.quantity,
        available,
        stockQuantity: detail.stockQuantity,
        lineTotalMinor: lineTotal,
      });
    }

    return {
      currency: this.storeCurrency,
      items: lines,
      subtotalMinor: subtotal,
    };
  }

  async checkout(
    userId: string,
    input: CheckoutInput,
    idempotencyKey: string,
  ): Promise<{ order: any; created: boolean }> {
    // Idempotencia: si ya existe, devolver el existente.
    const existing = await this.orderModel.findOne({
      where: { userId, idempotencyKey },
    });
    if (existing) {
      const items = await this.orderItemModel.findAll({
        where: { orderId: existing.id },
      });
      return { order: this.toOrderView(existing, items), created: false };
    }

    const shippingAddress = await this.resolveShippingAddress(userId, input);

    return this.sequelize.transaction(async (transaction) => {
      // Re-check idempotencia dentro de la transacción.
      const existingInTx = await this.orderModel.findOne({
        where: { userId, idempotencyKey },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingInTx) {
        const items = await this.orderItemModel.findAll({
          where: { orderId: existingInTx.id },
          transaction,
        });
        return { order: this.toOrderView(existingInTx, items), created: false };
      }

      const variantIds = [
        ...new Set(input.items.map((i) => i.variantId)),
      ].sort();
      const details = await this.loadVariantDetails(variantIds, transaction);

      // Validar disponibilidad y stock.
      const insufficient: Array<{ field: string; issue: string }> = [];
      let subtotal = 0;
      const lineData: Array<{
        detail: VariantDetail;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];

      for (const item of input.items) {
        const detail = details.get(item.variantId);
        if (
          !detail ||
          !detail.isActive ||
          detail.productStatus !== 'PUBLISHED'
        ) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            ErrorCode.PRODUCT_NOT_AVAILABLE,
            'Producto no disponible',
            [{ field: 'items', issue: 'product_not_available' }],
          );
        }

        if (!detail.allowBackorder && detail.stockQuantity < item.quantity) {
          insufficient.push({
            field: `items`,
            issue: `insufficient_stock:${item.variantId}`,
          });
        }

        const unitPrice = detail.priceMinor;
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        lineData.push({
          detail,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        });
      }

      if (insufficient.length > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.INSUFFICIENT_STOCK,
          'Stock insuficiente',
          insufficient,
        );
      }

      // Bloquear filas de inventario y re-verificar stock.
      const inventoryItems = await this.inventoryItemModel.findAll({
        where: { variantId: { [Op.in]: variantIds } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const inventoryByVariant = new Map(
        inventoryItems.map((row) => [row.variantId, row]),
      );

      for (const item of input.items) {
        const detail = details.get(item.variantId)!;
        const inv = inventoryByVariant.get(item.variantId);
        if (!inv) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            ErrorCode.PRODUCT_NOT_AVAILABLE,
            'Producto no disponible',
            [{ field: 'items', issue: 'no_inventory' }],
          );
        }
        if (!detail.allowBackorder && inv.quantity < item.quantity) {
          throw new AppException(
            HttpStatus.CONFLICT,
            ErrorCode.INSUFFICIENT_STOCK,
            'Stock insuficiente',
            [{ field: 'items', issue: `insufficient_stock:${item.variantId}` }],
          );
        }
      }

      // Crear pedido.
      const publicNumber = await this.generatePublicNumber(transaction);
      const order = await this.orderModel.create(
        {
          publicNumber,
          userId,
          status: 'PENDING_CONFIRMATION',
          paymentStatus: 'UNPAID',
          currency: this.storeCurrency,
          subtotalMinor: subtotal,
          shippingMinor: 0,
          totalMinor: subtotal,
          shippingAddress,
          idempotencyKey,
        },
        { transaction },
      );

      // Crear líneas y descontar stock.
      for (const line of lineData) {
        await this.orderItemModel.create(
          {
            orderId: order.id,
            productId: line.detail.product.id,
            variantId: line.detail.variant.id,
            name: line.detail.productName ?? line.detail.variant.sku,
            sku: line.detail.variant.sku,
            options: line.detail.optionsText,
            unitPriceMinor: line.unitPrice,
            quantity: line.quantity,
            lineTotalMinor: line.lineTotal,
          },
          { transaction },
        );

        const inv = inventoryByVariant.get(line.detail.variant.id)!;
        const newQty = inv.quantity - line.quantity;
        await inv.update({ quantity: newQty }, { transaction });

        await this.stockMovementModel.create(
          {
            variantId: line.detail.variant.id,
            delta: -line.quantity,
            reason: 'SALE',
            orderId: order.id,
            actorId: userId,
            note: 'Venta por checkout',
          },
          { transaction },
        );
      }

      await this.orderStatusHistoryModel.create(
        {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'PENDING_CONFIRMATION',
          actorId: userId,
          note: 'Pedido creado por checkout',
        },
        { transaction },
      );

      await this.auditService.record(
        {
          actorId: userId,
          action: 'order.create',
          entity: 'order',
          entityId: order.id,
          metadata: {
            publicNumber: order.publicNumber,
            totalMinor: order.totalMinor,
          },
        },
        transaction,
      );

      const items = await this.orderItemModel.findAll({
        where: { orderId: order.id },
        transaction,
      });
      return { order: this.toOrderView(order, items), created: true };
    });
  }

  private async resolveShippingAddress(
    userId: string,
    input: CheckoutInput,
  ): Promise<ShippingAddressSnapshot> {
    if (input.addressId) {
      const address = await this.addressModel.findOne({
        where: { id: input.addressId, userId },
      });
      if (!address) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          'La dirección no existe',
        );
      }
      return {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
      };
    }

    const addr = input.shippingAddress!;
    return {
      fullName: addr.fullName.trim(),
      phone: addr.phone.trim(),
      line1: addr.line1.trim(),
      line2: addr.line2?.trim() || null,
      city: addr.city.trim(),
      region: addr.region.trim(),
      postalCode: addr.postalCode.trim(),
      countryCode: addr.countryCode.trim().toUpperCase(),
    };
  }

  private async loadVariantDetails(
    variantIds: string[],
    transaction?: Transaction,
  ): Promise<Map<string, VariantDetail>> {
    if (variantIds.length === 0) {
      return new Map();
    }

    const variants = await this.variantModel.findAll({
      where: { id: { [Op.in]: variantIds } },
      transaction,
    });
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const [products, translations, optionLinks, inventoryItems] =
      await Promise.all([
        this.productModel.findAll({
          where: { id: { [Op.in]: productIds } },
          transaction,
        }),
        this.productTranslationModel.findAll({
          where: {
            productId: { [Op.in]: productIds },
            locale: this.defaultLocale,
          },
          transaction,
        }),
        this.variantOptionValueModel.findAll({
          where: { variantId: { [Op.in]: variantIds } },
          transaction,
        }),
        this.inventoryItemModel.findAll({
          where: { variantId: { [Op.in]: variantIds } },
          transaction,
        }),
      ]);

    const productsById = new Map(products.map((p) => [p.id, p]));
    const translationsByProduct = new Map(
      translations.map((t) => [t.productId, t]),
    );
    const inventoryByVariant = new Map(
      inventoryItems.map((i) => [i.variantId, i]),
    );

    // Load option value names
    const valueIds = [...new Set(optionLinks.map((l) => l.attributeValueId))];
    const [values, valueTranslations, attributes] = await Promise.all([
      valueIds.length > 0
        ? this.attributeValueModel.findAll({
            where: { id: { [Op.in]: valueIds } },
            transaction,
          })
        : Promise.resolve([]),
      valueIds.length > 0
        ? this.attributeValueTranslationModel.findAll({
            where: { attributeValueId: { [Op.in]: valueIds } },
            transaction,
          })
        : Promise.resolve([]),
      valueIds.length > 0
        ? this.attributeModel.findAll({
            where: {
              id: {
                [Op.in]: (
                  await this.attributeValueModel.findAll({
                    where: { id: { [Op.in]: valueIds } },
                    attributes: ['attributeId'],
                    raw: true,
                    transaction,
                  })
                ).map((v: any) => v.attributeId),
              },
            },
            transaction,
          })
        : Promise.resolve([]),
    ]);
    const valuesById = new Map(values.map((v) => [v.id, v]));
    const attributesById = new Map(attributes.map((a) => [a.id, a]));
    const valueTranslationsByValue = new Map(
      valueTranslations.map((t) => [t.attributeValueId, t]),
    );

    // Group option links by variant
    const optionsByVariant = new Map<string, string[]>();
    for (const link of optionLinks) {
      const value = valuesById.get(link.attributeValueId);
      if (!value) continue;
      const attr = attributesById.get(value.attributeId);
      const vtrans = valueTranslationsByValue.get(value.id);
      const label = `${attr?.code ?? ''}: ${vtrans?.name ?? value.code}`;
      const current = optionsByVariant.get(link.variantId) ?? [];
      current.push(label);
      optionsByVariant.set(link.variantId, current);
    }

    const result = new Map<string, VariantDetail>();
    for (const variant of variants) {
      const product = productsById.get(variant.productId);
      if (!product) continue;
      const translation = translationsByProduct.get(product.id);
      const inv = inventoryByVariant.get(variant.id);
      const options = optionsByVariant.get(variant.id);
      result.set(variant.id, {
        variant,
        product,
        productName: translation?.name ?? null,
        optionsText: options ? options.join(', ') : null,
        priceMinor: variant.priceMinor ?? product.basePriceMinor,
        stockQuantity: inv?.quantity ?? 0,
        allowBackorder: inv?.allowBackorder ?? false,
        isActive: variant.isActive,
        productStatus: product.status,
      });
    }
    return result;
  }

  private async generatePublicNumber(
    transaction: Transaction,
  ): Promise<string> {
    // Simple sequential-ish number: timestamp + random. Could be improved.
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    // Ensure uniqueness by checking; if collision, regenerate.
    let candidate = `TL-${stamp}-${rand}`;
    let exists = await this.orderModel.findOne({
      where: { publicNumber: candidate },
      transaction,
    });
    while (exists) {
      const r2 = Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0');
      candidate = `TL-${stamp}-${r2}`;
      exists = await this.orderModel.findOne({
        where: { publicNumber: candidate },
        transaction,
      });
    }
    return candidate;
  }

  private toOrderView(order: Order, items: OrderItem[]): any {
    return {
      id: order.id,
      publicNumber: order.publicNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      shippingMinor: order.shippingMinor,
      totalMinor: order.totalMinor,
      shippingAddress: order.shippingAddress,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        options: item.options,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: item.lineTotalMinor,
      })),
      createdAt: order.createdAt,
    };
  }
}
