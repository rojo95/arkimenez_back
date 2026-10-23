'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
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
    };

    await queryInterface.createTable('categories', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      image_storage_key: { type: Sequelize.STRING(255), allowNull: true },
      ...timestamps,
    });

    await queryInterface.createTable('category_translations', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      locale: { type: Sequelize.STRING(5), allowNull: false },
      name: { type: Sequelize.STRING(120), allowNull: false },
      slug: { type: Sequelize.STRING(160), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex(
      'category_translations',
      ['category_id', 'locale'],
      { unique: true, name: 'category_translations_category_locale_uq' },
    );
    await queryInterface.addIndex('category_translations', ['locale', 'slug'], {
      unique: true,
      name: 'category_translations_locale_slug_uq',
    });
    await queryInterface.addIndex('category_translations', ['slug'], {
      name: 'category_translations_slug_idx',
    });

    await queryInterface.createTable('attributes', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      code: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      is_variant_axis: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ...timestamps,
    });

    await queryInterface.createTable('attribute_translations', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'attributes', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      locale: { type: Sequelize.STRING(5), allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      ...timestamps,
    });
    await queryInterface.addIndex(
      'attribute_translations',
      ['attribute_id', 'locale'],
      { unique: true, name: 'attribute_translations_attribute_locale_uq' },
    );

    await queryInterface.createTable('attribute_values', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'attributes', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      code: { type: Sequelize.STRING(60), allowNull: false },
      ...timestamps,
    });
    await queryInterface.addIndex(
      'attribute_values',
      ['attribute_id', 'code'],
      { unique: true, name: 'attribute_values_attribute_code_uq' },
    );

    await queryInterface.createTable('attribute_value_translations', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      attribute_value_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'attribute_values', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      locale: { type: Sequelize.STRING(5), allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      ...timestamps,
    });
    await queryInterface.addIndex(
      'attribute_value_translations',
      ['attribute_value_id', 'locale'],
      { unique: true, name: 'attribute_value_translations_value_locale_uq' },
    );

    await queryInterface.createTable('products', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      status: {
        type: Sequelize.STRING(12),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      type: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'SIMPLE',
      },
      base_price_minor: { type: Sequelize.INTEGER, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addConstraint('products', {
      fields: ['status'],
      type: 'check',
      name: 'products_status_check',
      where: { status: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
    });
    await queryInterface.addConstraint('products', {
      fields: ['type'],
      type: 'check',
      name: 'products_type_check',
      where: { type: ['SIMPLE', 'VARIABLE'] },
    });
    await queryInterface.addConstraint('products', {
      fields: ['base_price_minor'],
      type: 'check',
      name: 'products_base_price_check',
      where: { base_price_minor: { [Sequelize.Op.gte]: 0 } },
    });
    await queryInterface.addIndex('products', ['status', 'deleted_at'], {
      name: 'products_status_deleted_idx',
    });

    await queryInterface.createTable('product_translations', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      locale: { type: Sequelize.STRING(5), allowNull: false },
      name: { type: Sequelize.STRING(160), allowNull: false },
      slug: { type: Sequelize.STRING(180), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex(
      'product_translations',
      ['product_id', 'locale'],
      { unique: true, name: 'product_translations_product_locale_uq' },
    );
    await queryInterface.addIndex('product_translations', ['locale', 'slug'], {
      unique: true,
      name: 'product_translations_locale_slug_uq',
    });
    await queryInterface.addIndex('product_translations', ['slug'], {
      name: 'product_translations_slug_idx',
    });

    await queryInterface.createTable('product_images', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      storage_key: { type: Sequelize.STRING(255), allowNull: false },
      mime: { type: Sequelize.STRING(50), allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false },
      alt: { type: Sequelize.STRING(255), allowNull: true },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      ...timestamps,
    });
    await queryInterface.addIndex('product_images', ['product_id'], {
      name: 'product_images_product_idx',
    });
    await queryInterface.addConstraint('product_images', {
      fields: ['position'],
      type: 'check',
      name: 'product_images_position_check',
      where: { position: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.createTable('product_categories', {
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'categories', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('product_categories', ['category_id'], {
      name: 'product_categories_category_idx',
    });

    await queryInterface.createTable('product_variants', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      sku: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      price_minor: { type: Sequelize.INTEGER, allowNull: true },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      // Clave técnica para garantizar combinaciones únicas por producto.
      combination_key: { type: Sequelize.STRING(64), allowNull: false },
      ...timestamps,
    });
    await queryInterface.addIndex(
      'product_variants',
      ['product_id', 'combination_key'],
      { unique: true, name: 'product_variants_product_combination_uq' },
    );
    await queryInterface.addIndex('product_variants', ['product_id'], {
      name: 'product_variants_product_idx',
    });
    await queryInterface.addConstraint('product_variants', {
      fields: ['price_minor'],
      type: 'check',
      name: 'product_variants_price_check',
      where: { price_minor: { [Sequelize.Op.gte]: 0 } },
    });

    await queryInterface.createTable('variant_option_values', {
      variant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'product_variants', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      attribute_value_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'attribute_values', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex(
      'variant_option_values',
      ['attribute_value_id'],
      { name: 'variant_option_values_value_idx' },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('variant_option_values');
    await queryInterface.dropTable('product_variants');
    await queryInterface.dropTable('product_categories');
    await queryInterface.dropTable('product_images');
    await queryInterface.dropTable('product_translations');
    await queryInterface.dropTable('products');
    await queryInterface.dropTable('attribute_value_translations');
    await queryInterface.dropTable('attribute_values');
    await queryInterface.dropTable('attribute_translations');
    await queryInterface.dropTable('attributes');
    await queryInterface.dropTable('category_translations');
    await queryInterface.dropTable('categories');
  },
};
