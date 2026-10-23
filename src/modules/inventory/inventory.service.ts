import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { ProductVariant } from '../catalog/models/product-variant.model';
import { InventoryItem } from './models/inventory-item.model';
import { StockMovement } from './models/stock-movement.model';

export interface InventoryItemView {
  variantId: string;
  sku: string;
  productId: string;
  quantity: number;
  allowBackorder: boolean;
  updatedAt: Date;
}

export interface AdjustStockInput {
  quantity?: number;
  delta?: number;
  allowBackorder?: boolean;
  note: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem)
    private readonly inventoryItemModel: typeof InventoryItem,
    @InjectModel(StockMovement)
    private readonly stockMovementModel: typeof StockMovement,
    @InjectModel(ProductVariant)
    private readonly variantModel: typeof ProductVariant,
    private readonly sequelize: Sequelize,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crea el registro de inventario de una variante recién creada. Debe
   * ejecutarse dentro de la transacción del alta del producto.
   */
  async initializeVariant(
    variantId: string,
    quantity: number,
    allowBackorder: boolean,
    transaction: Transaction,
  ): Promise<void> {
    await this.inventoryItemModel.create(
      { variantId, quantity, allowBackorder },
      { transaction },
    );

    if (quantity > 0) {
      await this.stockMovementModel.create(
        {
          variantId,
          delta: quantity,
          reason: 'INITIAL',
          note: 'Stock inicial',
        },
        { transaction },
      );
    }
  }

  async getStockMap(
    variantIds: string[],
  ): Promise<Map<string, { quantity: number; allowBackorder: boolean }>> {
    if (variantIds.length === 0) {
      return new Map();
    }

    const rows = await this.inventoryItemModel.findAll({
      where: { variantId: { [Op.in]: variantIds } },
      raw: true,
    });

    return new Map(
      rows.map((row) => [
        row.variantId,
        { quantity: row.quantity, allowBackorder: row.allowBackorder },
      ]),
    );
  }

  async getInStockVariantIds(): Promise<string[]> {
    const rows = await this.inventoryItemModel.findAll({
      where: {
        [Op.or]: [{ quantity: { [Op.gt]: 0 } }, { allowBackorder: true }],
      },
      attributes: ['variantId'],
      raw: true,
    });
    return rows.map((row) => row.variantId);
  }

  /** Ajuste manual con bloqueo de fila y movimiento auditado (RF-INV-02). */
  async adjust(
    variantId: string,
    input: AdjustStockInput,
    actorId: string,
  ): Promise<InventoryItemView> {
    return this.sequelize.transaction(async (transaction) => {
      const variant = await this.variantModel.findByPk(variantId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!variant) {
        throw this.variantNotFound();
      }

      const item = await this.inventoryItemModel.findOne({
        where: { variantId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!item) {
        throw this.variantNotFound();
      }

      const nextQuantity = input.quantity ?? item.quantity + (input.delta ?? 0);
      const appliedDelta = nextQuantity - item.quantity;

      if (nextQuantity < 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.INSUFFICIENT_STOCK,
          'El stock no puede quedar negativo',
          [{ field: 'quantity', issue: 'would_be_negative' }],
        );
      }

      if (appliedDelta === 0 && input.allowBackorder === undefined) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.INVALID_QUANTITY,
          'El ajuste no produce ningún cambio',
          [{ field: 'quantity', issue: 'no_change' }],
        );
      }

      await item.update(
        {
          quantity: nextQuantity,
          ...(input.allowBackorder === undefined
            ? {}
            : { allowBackorder: input.allowBackorder }),
        },
        { transaction },
      );

      if (appliedDelta !== 0) {
        await this.stockMovementModel.create(
          {
            variantId,
            delta: appliedDelta,
            reason: 'ADJUSTMENT',
            actorId,
            note: input.note,
          },
          { transaction },
        );
      }

      await this.auditService.record(
        {
          actorId,
          action: 'inventory.adjust',
          entity: 'inventory_item',
          entityId: item.id,
          metadata: {
            variantId,
            previousQuantity: nextQuantity - appliedDelta,
            newQuantity: nextQuantity,
            delta: appliedDelta,
            note: input.note,
          },
        },
        transaction,
      );

      return {
        variantId,
        sku: variant.sku,
        productId: variant.productId,
        quantity: nextQuantity,
        allowBackorder: item.allowBackorder,
        updatedAt: item.updatedAt,
      };
    });
  }

  async list(
    page: number,
    pageSize: number,
  ): Promise<{ items: InventoryItemView[]; total: number }> {
    const { rows, count } = await this.inventoryItemModel.findAndCountAll({
      order: [['updatedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const variants = await this.variantModel.findAll({
      where: { id: { [Op.in]: rows.map((row) => row.variantId) } },
      raw: true,
    });
    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    return {
      items: rows.map((row) => ({
        variantId: row.variantId,
        sku: variantsById.get(row.variantId)?.sku ?? '',
        productId: variantsById.get(row.variantId)?.productId ?? '',
        quantity: row.quantity,
        allowBackorder: row.allowBackorder,
        updatedAt: row.updatedAt,
      })),
      total: count,
    };
  }

  async listMovements(variantId: string, page: number, pageSize: number) {
    const variant = await this.variantModel.findByPk(variantId);
    if (!variant) {
      throw this.variantNotFound();
    }

    const { rows, count } = await this.stockMovementModel.findAndCountAll({
      where: { variantId },
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        variantId: row.variantId,
        delta: row.delta,
        reason: row.reason,
        orderId: row.orderId,
        actorId: row.actorId,
        note: row.note,
        createdAt: row.createdAt,
      })),
      total: count,
    };
  }

  private variantNotFound(): AppException {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.NOT_FOUND,
      'Variante no encontrada',
    );
  }
}
