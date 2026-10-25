'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('addresses', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      full_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      line1: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      line2: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      region: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      country_code: {
        type: Sequelize.STRING(2),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(30),
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

    await queryInterface.addIndex('addresses', ['user_id'], {
      name: 'addresses_user_id_idx',
    });

    await queryInterface.addConstraint('addresses', {
      fields: ['country_code'],
      type: 'check',
      name: 'addresses_country_code_length_check',
      where: Sequelize.literal('char_length(country_code) = 2'),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('addresses');
  },
};
