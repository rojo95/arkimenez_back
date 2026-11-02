import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { AuditService } from '../audit/audit.service';
import { InventoryItem } from '../inventory/models/inventory-item.model';
import { StockMovement } from '../inventory/models/stock-movement.model';
import { Order } from './models/order.model';
import { OrderItem } from './models/order-item.model';
import { OrderStatusHistory } from './models/order-status-history.model';
import { canTransition, isCancellable } from './order-state-machine';
import type { ListOrdersQuery } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order) private readonly orderModel: typeof Order,
    @InjectModel(OrderItem) private readonly orderItemModel: typeof OrderItem,
    @InjectModel(OrderStatusHistory)
    private readonly historyModel: typeof OrderStatusHistory,
    @InjectModel(InventoryItem)
    private readonly inventoryItemModel: typeof InventoryItem,
    @InjectModel(StockMovement)
    private readonly stockMovementModel: typeof StockMovement,
    private readonly auditService: AuditService,
  ) {}

  async getOrderForUser(userId: string, orderId: string) {
    const order = await this.orderModel.findOne({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Pedido no encontrado',
      );
    }
    const items = await this.orderItemModel.findAll({ where: { orderId } });
    return this.toView(order, items);
  }

  async listForUser(userId: string, query: ListOrdersQuery) {
    const { rows, count } = await this.orderModel.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    const items = await this.orderItemModel.findAll({
      where: { orderId: { [Op.in]: rows.map((r) => r.id) } },
    });
    const byOrder = new Map<string, typeof items>();
    for (const item of items) {
      const list = byOrder.get(item.orderId) ?? [];
      list.push(item);
      byOrder.set(item.orderId, list);
    }
    return {
      items: rows.map((order) =>
        this.toView(order, byOrder.get(order.id) ?? []),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total: count,
      totalPages: Math.ceil(count / query.pageSize),
    };
  }

  async listAll(query: ListOrdersQuery) {
    const { rows, count } = await this.orderModel.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    const items = await this.orderItemModel.findAll({
      where: { orderId: { [Op.in]: rows.map((r) => r.id) } },
    });
    const byOrder = new Map<string, typeof items>();
    for (const item of items) {
      const list = byOrder.get(item.orderId) ?? [];
      list.push(item);
      byOrder.set(item.orderId, list);
    }
    return {
      items: rows.map((order) =>
        this.toView(order, byOrder.get(order.id) ?? []),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total: count,
      totalPages: Math.ceil(count / query.pageSize),
    };
  }

  async getOrder(orderId: string) {
    const order = await this.orderModel.findByPk(orderId);
    if (!order) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Pedido no encontrado',
      );
    }
    const items = await this.orderItemModel.findAll({ where: { orderId } });
    return this.toView(order, items);
  }

  async updateStatus(
    orderId: string,
    toStatus: string,
    actorId: string,
    note?: string,
  ) {
    return (this.orderModel.sequelize as any).transaction(
      async (transaction: any) => {
        const order = await this.orderModel.findByPk(orderId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!order) {
          throw new AppException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOT_FOUND,
            'Pedido no encontrado',
          );
        }
        const from = order.status as any;
        if (!canTransition(from, toStatus as any)) {
          throw new AppException(
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_ORDER_TRANSITION,
            'Transición de pedido no permitida',
          );
        }

        // Restock if cancelling.
        if (toStatus === 'CANCELLED' && isCancellable(from)) {
          const items = await this.orderItemModel.findAll({
            where: { orderId },
            transaction,
          });
          for (const item of items) {
            if (!item.variantId) continue;
            const inv = await this.inventoryItemModel.findOne({
              where: { variantId: item.variantId },
              transaction,
              lock: transaction.LOCK.UPDATE,
            });
            if (inv) {
              await inv.update(
                { quantity: inv.quantity + item.quantity },
                { transaction },
              );
              await this.stockMovementModel.create(
                {
                  variantId: item.variantId,
                  delta: item.quantity,
                  reason: 'CANCEL_RESTOCK',
                  orderId,
                  actorId,
                  note: note ?? 'Cancelación de pedido',
                },
                { transaction },
              );
            }
          }
        }

        order.status = toStatus as any;
        await order.save({ transaction });

        await this.historyModel.create(
          {
            orderId,
            fromStatus: from,
            toStatus,
            actorId,
            note: note ?? null,
          },
          { transaction },
        );

        await this.auditService.record(
          {
            actorId,
            action: 'order.update_status',
            entity: 'order',
            entityId: orderId,
            metadata: { from, to: toStatus },
          },
          transaction,
        );

        const items = await this.orderItemModel.findAll({
          where: { orderId },
          transaction,
        });
        return this.toView(order, items);
      },
    );
  }

  async cancelByCustomer(userId: string, orderId: string) {
    const order = await this.orderModel.findOne({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Pedido no encontrado',
      );
    }
    if (order.status !== 'PENDING_CONFIRMATION') {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.INVALID_ORDER_TRANSITION,
        'Solo se pueden cancelar pedidos en confirmación pendiente',
      );
    }
    return this.updateStatus(
      orderId,
      'CANCELLED',
      userId,
      'Cancelado por el cliente',
    );
  }

  private toView(order: Order, items: OrderItem[]) {
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
