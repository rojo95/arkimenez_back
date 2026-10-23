'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_items', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'product_variants', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      allow_backorder: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.addConstraint('inventory_items', {
      fields: ['quantity'],
      type: 'check',
      name: 'inventory_items_quantity_check',
      where: { quantity: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.createTable('stock_movements', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'product_variants', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      delta: { type: Sequelize.INTEGER, allowNull: false },
      reason: { type: Sequelize.STRING(20), allowNull: false },
      order_id: { type: Sequelize.UUID, allowNull: true },
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      note: { type: Sequelize.STRING(255), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addConstraint('stock_movements', {
      fields: ['reason'],
      type: 'check',
      name: 'stock_movements_reason_check',
      where: {
        reason: ['SALE', 'CANCEL_RESTOCK', 'ADJUSTMENT', 'INITIAL'],
      },
    });
    await queryInterface.addConstraint('stock_movements', {
      fields: ['delta'],
      type: 'check',
      name: 'stock_movements_delta_check',
      where: { delta: { [Sequelize.Op.ne]: 0 } },
    });
    await queryInterface.addIndex('stock_movements', ['variant_id'], {
      name: 'stock_movements_variant_idx',
    });
    await queryInterface.addIndex('stock_movements', ['created_at'], {
      name: 'stock_movements_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_movements');
    await queryInterface.dropTable('inventory_items');
  },
};
