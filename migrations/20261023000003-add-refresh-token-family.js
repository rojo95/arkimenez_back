'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('refresh_tokens', 'family_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      'UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL',
    );

    await queryInterface.changeColumn('refresh_tokens', 'family_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.addIndex('refresh_tokens', ['family_id'], {
      name: 'refresh_tokens_family_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'refresh_tokens',
      'refresh_tokens_family_id_idx',
    );
    await queryInterface.removeColumn('refresh_tokens', 'family_id');
  },
};
