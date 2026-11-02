'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      public_number: {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'PENDING_CONFIRMATION',
      },
      payment_status: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'UNPAID',
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      subtotal_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shipping_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shipping_address: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      idempotency_key: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('orders', ['user_id'], {
      name: 'orders_user_id_idx',
    });
    await queryInterface.addIndex('orders', ['status'], {
      name: 'orders_status_idx',
    });
    await queryInterface.addConstraint('orders', {
      fields: ['user_id', 'idempotency_key'],
      type: 'unique',
      name: 'orders_user_idempotency_key_unique',
    });

    await queryInterface.createTable('order_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'products', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'product_variants', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(240),
        allowNull: false,
      },
      sku: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      options: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      unit_price_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      line_total_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('order_items', ['order_id'], {
      name: 'order_items_order_id_idx',
    });

    await queryInterface.addConstraint('order_items', {
      fields: ['quantity'],
      type: 'check',
      name: 'order_items_quantity_positive_check',
      where: Sequelize.literal('quantity > 0'),
    });

    await queryInterface.createTable('order_status_history', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      from_status: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('order_status_history', ['order_id'], {
      name: 'order_status_history_order_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_status_history');
    await queryInterface.dropTable('order_items');
    await queryInterface.dropTable('orders');
  },
};
