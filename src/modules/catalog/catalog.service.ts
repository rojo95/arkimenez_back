import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { createHash } from 'node:crypto';
import { Op, type Order, type Transaction, type WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { pickTranslation } from '../../shared/i18n/locale';
import { slugify } from '../../shared/utils/slug';
import { InventoryService } from '../inventory/inventory.service';
import {
  CatalogLocaleService,
  type LocaleContext,
} from './catalog-locale.service';
import type {
  AdminProductsQuery,
  CreateAttributeInput,
  CreateAttributeValueInput,
  CreateCategoryInput,
  CreateProductInput,
  ListProductsQuery,
  TranslationInput,
  UpdateAttributeInput,
  UpdateAttributeValueInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
  VariantInput,
} from './catalog.types';
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

interface LoadedProductData {
  translations: ProductTranslation[];
  images: ProductImage[];
  variants: ProductVariant[];
  categoryIds: string[];
  categoryTranslations: CategoryTranslation[];
  optionValuesByVariant: Map<string, OptionValueView[]>;
  stock: Map<string, { quantity: number; allowBackorder: boolean }>;
}

interface OptionValueView {
  attributeId: string;
  attributeCode: string;
  valueId: string;
  valueCode: string;
  valueName: string;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Product) private readonly productModel: typeof Product,
    @InjectModel(ProductTranslation)
    private readonly productTranslationModel: typeof ProductTranslation,
    @InjectModel(ProductImage)
    private readonly productImageModel: typeof ProductImage,
    @InjectModel(ProductCategory)
    private readonly productCategoryModel: typeof ProductCategory,
    @InjectModel(ProductVariant)
    private readonly variantModel: typeof ProductVariant,
    @InjectModel(VariantOptionValue)
    private readonly optionValueModel: typeof VariantOptionValue,
    @InjectModel(Category) private readonly categoryModel: typeof Category,
    @InjectModel(CategoryTranslation)
    private readonly categoryTranslationModel: typeof CategoryTranslation,
    @InjectModel(Attribute) private readonly attributeModel: typeof Attribute,
    @InjectModel(AttributeTranslation)
    private readonly attributeTranslationModel: typeof AttributeTranslation,
    @InjectModel(AttributeValue)
    private readonly attributeValueModel: typeof AttributeValue,
    @InjectModel(AttributeValueTranslation)
    private readonly attributeValueTranslationModel: typeof AttributeValueTranslation,
    private readonly sequelize: Sequelize,
    private readonly localeService: CatalogLocaleService,
    private readonly inventoryService: InventoryService,
    private readonly imageService: ImageService,
  ) {}

  // -------------------------------------------------------------------------
  // Catálogo público
  // -------------------------------------------------------------------------

  async listPublicProducts(
    query: ListProductsQuery,
    acceptLanguage: string | undefined,
  ) {
    const locale = await this.localeService.resolve(
      query.locale,
      acceptLanguage,
    );
    const and: WhereOptions[] = [];

    if (query.category) {
      const categoryIds = await this.resolveCategoryIds(query.category, locale);
      const links = await this.productCategoryModel.findAll({
        where: { categoryId: { [Op.in]: categoryIds } },
        attributes: ['productId'],
        raw: true,
      });
      and.push({ id: { [Op.in]: links.map((link) => link.productId) } });
    }

    if (query.q) {
      const term = `%${query.q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
      const translations = await this.productTranslationModel.findAll({
        where: { name: { [Op.iLike]: term } },
        attributes: ['productId'],
        raw: true,
      });
      and.push({
        id: {
          [Op.in]: translations.map((translation) => translation.productId),
        },
      });
    }

    if (query.availability === 'in_stock') {
      const inStockVariantIds =
        await this.inventoryService.getInStockVariantIds();
      const variants = await this.variantModel.findAll({
        where: { id: { [Op.in]: inStockVariantIds } },
        attributes: ['productId'],
        raw: true,
      });
      and.push({
        id: { [Op.in]: variants.map((variant) => variant.productId) },
      });
    }

    const where: WhereOptions = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(and.length > 0 ? { [Op.and]: and } : {}),
    };

    const order: Order =
      query.sort === 'price_asc'
        ? [['basePriceMinor', 'ASC']]
        : query.sort === 'price_desc'
          ? [['basePriceMinor', 'DESC']]
          : [['createdAt', 'DESC']];

    const { rows, count } = await this.productModel.findAndCountAll({
      where,
      order,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    const data = await this.loadProductData(rows.map((product) => product.id));

    return {
      items: rows.map((product) => this.toPublicProduct(product, data, locale)),
      page: query.page,
      pageSize: query.pageSize,
      total: count,
      totalPages: Math.ceil(count / query.pageSize),
    };
  }

  async getPublicProduct(
    identifier: string,
    requestedLocale: string | undefined,
    acceptLanguage: string | undefined,
  ) {
    const locale = await this.localeService.resolve(
      requestedLocale,
      acceptLanguage,
    );
    const product = await this.findPublishedProduct(identifier, locale);
    const data = await this.loadProductData([product.id]);
    return this.toPublicProduct(product, data, locale);
  }

  async listPublicCategories(
    requestedLocale: string | undefined,
    acceptLanguage: string | undefined,
  ) {
    const locale = await this.localeService.resolve(
      requestedLocale,
      acceptLanguage,
    );
    const categories = await this.categoryModel.findAll({
      where: { isActive: true },
      order: [['createdAt', 'ASC']],
    });
    const translations = await this.categoryTranslationModel.findAll({
      where: {
        categoryId: { [Op.in]: categories.map((category) => category.id) },
      },
    });

    return categories.map((category) => {
      const translation = pickTranslation(
        translations.filter((row) => row.categoryId === category.id),
        locale.locale,
        locale.defaultLocale,
      );
      return {
        id: category.id,
        slug: translation?.slug ?? null,
        name: translation?.name ?? null,
        description: translation?.description ?? null,
        imageUrl: category.imageStorageKey
          ? this.imageService.publicUrl(category.imageStorageKey)
          : null,
      };
    });
  }

  async listPublicAttributes(
    requestedLocale: string | undefined,
    acceptLanguage: string | undefined,
  ) {
    const locale = await this.localeService.resolve(
      requestedLocale,
      acceptLanguage,
    );
    return this.listAttributes(locale);
  }

  // -------------------------------------------------------------------------
  // Administración de productos
  // -------------------------------------------------------------------------

  async listAdminProducts(query: AdminProductsQuery) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.status) {
      where.status = query.status;
    }

    const { rows, count } = await this.productModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    const data = await this.loadProductData(rows.map((product) => product.id));

    return {
      items: rows.map((product) => this.toAdminProduct(product, data)),
      page: query.page,
      pageSize: query.pageSize,
      total: count,
      totalPages: Math.ceil(count / query.pageSize),
    };
  }

  async getAdminProduct(id: string) {
    const product = await this.findProductOrThrow(id);
    const data = await this.loadProductData([product.id]);
    return this.toAdminProduct(product, data);
  }

  async createProduct(input: CreateProductInput) {
    this.assertUniqueLocales(input.translations);

    const productId = await this.sequelize.transaction(async (transaction) => {
      await this.assertCategoriesExist(input.categoryIds ?? [], transaction);
      this.assertVariantInput(input);

      const product = await this.productModel.create(
        {
          type: input.type,
          basePriceMinor: input.basePriceMinor,
          status: 'DRAFT',
        },
        { transaction },
      );

      for (const translation of input.translations) {
        await this.createProductTranslation(
          product.id,
          translation,
          transaction,
        );
      }

      if ((input.categoryIds ?? []).length > 0) {
        await this.productCategoryModel.bulkCreate(
          input.categoryIds!.map((categoryId) => ({
            productId: product.id,
            categoryId,
          })),
          { transaction },
        );
      }

      await this.createVariants(product, input, transaction);
      return product.id;
    });

    return this.getAdminProduct(productId);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    const product = await this.findProductOrThrow(id);

    if (input.translations) {
      this.assertUniqueLocales(input.translations);
    }

    await this.sequelize.transaction(async (transaction) => {
      if (input.basePriceMinor !== undefined) {
        await product.update(
          { basePriceMinor: input.basePriceMinor },
          { transaction },
        );
      }

      for (const translation of input.translations ?? []) {
        await this.upsertProductTranslation(
          product.id,
          translation,
          transaction,
        );
      }

      if (input.categoryIds) {
        await this.assertCategoriesExist(input.categoryIds, transaction);
        await this.productCategoryModel.destroy({
          where: { productId: product.id },
          transaction,
        });
        if (input.categoryIds.length > 0) {
          await this.productCategoryModel.bulkCreate(
            input.categoryIds.map((categoryId) => ({
              productId: product.id,
              categoryId,
            })),
            { transaction },
          );
        }
      }
    });

    return this.getAdminProduct(product.id);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
  ) {
    const product = await this.findProductOrThrow(productId);
    const variant = await this.variantModel.findOne({
      where: { id: variantId, productId: product.id },
    });

    if (!variant) {
      throw this.notFound('Variante no encontrada');
    }

    if (
      input.isActive === false &&
      variant.isActive &&
      product.status === 'PUBLISHED'
    ) {
      const otherActive = await this.variantModel.count({
        where: {
          productId: product.id,
          isActive: true,
          id: { [Op.ne]: variant.id },
        },
      });
      if (otherActive === 0) {
        throw this.unprocessable(
          ErrorCode.PRODUCT_VARIANT_REQUIRED,
          'Un producto publicado necesita al menos una variante activa',
        );
      }
    }

    await variant.update({
      ...(input.priceMinor === undefined
        ? {}
        : { priceMinor: input.priceMinor }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    });

    return this.getAdminProduct(product.id);
  }

  async changeStatus(id: string, target: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED') {
    const product = await this.findProductOrThrow(id);

    if (product.status === target) {
      return this.getAdminProduct(product.id);
    }

    if (!ALLOWED_TRANSITIONS[product.status]?.includes(target)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.INVALID_PRODUCT_TRANSITION,
        `No se puede pasar de ${product.status} a ${target}`,
      );
    }

    if (target === 'PUBLISHED') {
      await this.assertPublishable(product);
    }

    await product.update({ status: target });
    return this.getAdminProduct(product.id);
  }

  async addImage(
    productId: string,
    file: Express.Multer.File,
    alt: string | undefined,
  ) {
    const product = await this.findProductOrThrow(productId);
    const processed = await this.imageService.processUpload(product.id, file);

    try {
      const position = await this.productImageModel.count({
        where: { productId: product.id },
      });
      const image = await this.productImageModel.create({
        productId: product.id,
        storageKey: processed.storageKey,
        mime: processed.mime,
        sizeBytes: processed.sizeBytes,
        alt: alt ?? null,
        position,
      });

      return {
        id: image.id,
        alt: image.alt,
        position: image.position,
        urls: this.imageService.toPublicUrls(image.storageKey),
      };
    } catch (error) {
      await this.imageService.deleteImage(processed.storageKey);
      throw error;
    }
  }

  async removeImage(productId: string, imageId: string) {
    const product = await this.findProductOrThrow(productId);
    const image = await this.productImageModel.findOne({
      where: { id: imageId, productId: product.id },
    });

    if (!image) {
      throw this.notFound('Imagen no encontrada');
    }

    if (product.status === 'PUBLISHED') {
      const imageCount = await this.productImageModel.count({
        where: { productId: product.id },
      });
      if (imageCount <= 1) {
        throw this.unprocessable(
          ErrorCode.PRODUCT_IMAGE_REQUIRED,
          'Un producto publicado necesita al menos una imagen',
        );
      }
    }

    await image.destroy();
    await this.imageService.deleteImage(image.storageKey);
    return { deleted: true };
  }

  // -------------------------------------------------------------------------
  // Categorías
  // -------------------------------------------------------------------------

  async listAdminCategories() {
    const categories = await this.categoryModel.findAll({
      order: [['createdAt', 'ASC']],
    });
    const translations = await this.categoryTranslationModel.findAll({
      where: {
        categoryId: { [Op.in]: categories.map((category) => category.id) },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      isActive: category.isActive,
      imageUrl: category.imageStorageKey
        ? this.imageService.publicUrl(category.imageStorageKey)
        : null,
      translations: translations
        .filter((row) => row.categoryId === category.id)
        .map((row) => ({
          locale: row.locale,
          name: row.name,
          slug: row.slug,
          description: row.description,
        })),
    }));
  }

  async createCategory(input: CreateCategoryInput) {
    this.assertUniqueLocales(input.translations);

    const categoryId = await this.sequelize.transaction(async (transaction) => {
      const category = await this.categoryModel.create(
        { isActive: input.isActive ?? true },
        { transaction },
      );

      for (const translation of input.translations) {
        await this.createCategoryTranslation(
          category.id,
          translation,
          transaction,
        );
      }

      return category.id;
    });

    const categories = await this.listAdminCategories();
    return categories.find((category) => category.id === categoryId);
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    const category = await this.categoryModel.findByPk(id);
    if (!category) {
      throw this.notFound('Categoría no encontrada');
    }

    if (input.translations) {
      this.assertUniqueLocales(input.translations);
    }

    await this.sequelize.transaction(async (transaction) => {
      if (input.isActive !== undefined) {
        await category.update({ isActive: input.isActive }, { transaction });
      }

      for (const translation of input.translations ?? []) {
        await this.upsertCategoryTranslation(
          category.id,
          translation,
          transaction,
        );
      }
    });

    const categories = await this.listAdminCategories();
    return categories.find((item) => item.id === category.id);
  }

  // -------------------------------------------------------------------------
  // Atributos
  // -------------------------------------------------------------------------

  async listAttributes(locale: LocaleContext) {
    const attributes = await this.attributeModel.findAll({
      order: [['code', 'ASC']],
    });
    const attributeIds = attributes.map((attribute) => attribute.id);
    const [attributeTranslations, values] = await Promise.all([
      this.attributeTranslationModel.findAll({
        where: { attributeId: { [Op.in]: attributeIds } },
      }),
      this.attributeValueModel.findAll({
        where: { attributeId: { [Op.in]: attributeIds } },
        order: [['code', 'ASC']],
      }),
    ]);
    const valueTranslations = await this.attributeValueTranslationModel.findAll(
      {
        where: {
          attributeValueId: { [Op.in]: values.map((value) => value.id) },
        },
      },
    );

    return attributes.map((attribute) => ({
      id: attribute.id,
      code: attribute.code,
      isVariantAxis: attribute.isVariantAxis,
      name:
        pickTranslation(
          attributeTranslations.filter(
            (translation) => translation.attributeId === attribute.id,
          ),
          locale.locale,
          locale.defaultLocale,
        )?.name ?? attribute.code,
      values: values
        .filter((value) => value.attributeId === attribute.id)
        .map((value) => ({
          id: value.id,
          code: value.code,
          name:
            pickTranslation(
              valueTranslations.filter(
                (translation) => translation.attributeValueId === value.id,
              ),
              locale.locale,
              locale.defaultLocale,
            )?.name ?? value.code,
        })),
    }));
  }

  async createAttribute(input: CreateAttributeInput) {
    this.assertUniqueLocales(input.translations);
    const existing = await this.attributeModel.findOne({
      where: { code: input.code },
    });
    if (existing) {
      throw this.conflict(
        ErrorCode.CODE_ALREADY_EXISTS,
        'Ya existe un atributo con ese código',
        [{ field: 'code', issue: 'already_exists' }],
      );
    }

    const attributeId = await this.sequelize.transaction(
      async (transaction) => {
        const attribute = await this.attributeModel.create(
          { code: input.code, isVariantAxis: input.isVariantAxis ?? true },
          { transaction },
        );
        for (const translation of input.translations) {
          await this.attributeTranslationModel.create(
            {
              attributeId: attribute.id,
              locale: translation.locale,
              name: translation.name,
            },
            { transaction },
          );
        }
        return attribute.id;
      },
    );

    const locale = await this.localeService.resolve(undefined, undefined);
    const attributes = await this.listAttributes(locale);
    return attributes.find((attribute) => attribute.id === attributeId);
  }

  async updateAttribute(id: string, input: UpdateAttributeInput) {
    const attribute = await this.attributeModel.findByPk(id);
    if (!attribute) {
      throw this.notFound('Atributo no encontrado');
    }
    if (input.translations) {
      this.assertUniqueLocales(input.translations);
    }

    await this.sequelize.transaction(async (transaction) => {
      if (input.isVariantAxis !== undefined) {
        await attribute.update(
          { isVariantAxis: input.isVariantAxis },
          { transaction },
        );
      }
      for (const translation of input.translations ?? []) {
        const [row] = await this.attributeTranslationModel.findOrCreate({
          where: { attributeId: attribute.id, locale: translation.locale },
          defaults: {
            attributeId: attribute.id,
            locale: translation.locale,
            name: translation.name,
          },
          transaction,
        });
        await row.update({ name: translation.name }, { transaction });
      }
    });

    const locale = await this.localeService.resolve(undefined, undefined);
    const attributes = await this.listAttributes(locale);
    return attributes.find((item) => item.id === attribute.id);
  }

  async createAttributeValue(
    attributeId: string,
    input: CreateAttributeValueInput,
  ) {
    this.assertUniqueLocales(input.translations);
    const attribute = await this.attributeModel.findByPk(attributeId);
    if (!attribute) {
      throw this.notFound('Atributo no encontrado');
    }

    const existing = await this.attributeValueModel.findOne({
      where: { attributeId, code: input.code },
    });
    if (existing) {
      throw this.conflict(
        ErrorCode.CODE_ALREADY_EXISTS,
        'Ya existe un valor con ese código para el atributo',
        [{ field: 'code', issue: 'already_exists' }],
      );
    }

    const valueId = await this.sequelize.transaction(async (transaction) => {
      const value = await this.attributeValueModel.create(
        { attributeId, code: input.code },
        { transaction },
      );
      for (const translation of input.translations) {
        await this.attributeValueTranslationModel.create(
          {
            attributeValueId: value.id,
            locale: translation.locale,
            name: translation.name,
          },
          { transaction },
        );
      }
      return value.id;
    });

    const locale = await this.localeService.resolve(undefined, undefined);
    const attributes = await this.listAttributes(locale);
    const attributeView = attributes.find((item) => item.id === attributeId);
    return attributeView?.values.find((value) => value.id === valueId);
  }

  async updateAttributeValue(
    attributeId: string,
    valueId: string,
    input: UpdateAttributeValueInput,
  ) {
    this.assertUniqueLocales(input.translations);
    const value = await this.attributeValueModel.findOne({
      where: { id: valueId, attributeId },
    });
    if (!value) {
      throw this.notFound('Valor de atributo no encontrado');
    }

    await this.sequelize.transaction(async (transaction) => {
      for (const translation of input.translations) {
        const [row] = await this.attributeValueTranslationModel.findOrCreate({
          where: { attributeValueId: value.id, locale: translation.locale },
          defaults: {
            attributeValueId: value.id,
            locale: translation.locale,
            name: translation.name,
          },
          transaction,
        });
        await row.update({ name: translation.name }, { transaction });
      }
    });

    const locale = await this.localeService.resolve(undefined, undefined);
    const attributes = await this.listAttributes(locale);
    return attributes
      .find((item) => item.id === attributeId)
      ?.values.find((item) => item.id === valueId);
  }

  // -------------------------------------------------------------------------
  // Helpers internos
  // -------------------------------------------------------------------------

  private async findPublishedProduct(
    identifier: string,
    locale: LocaleContext,
  ) {
    let product: Product | null = null;

    if (UUID_PATTERN.test(identifier)) {
      product = await this.productModel.findOne({
        where: { id: identifier, status: 'PUBLISHED', deletedAt: null },
      });
    } else {
      const translations = await this.productTranslationModel.findAll({
        where: { slug: identifier },
      });
      const translation =
        translations.find((row) => row.locale === locale.locale) ??
        translations.find((row) => row.locale === locale.defaultLocale) ??
        translations[0];

      if (translation) {
        product = await this.productModel.findOne({
          where: {
            id: translation.productId,
            status: 'PUBLISHED',
            deletedAt: null,
          },
        });
      }
    }

    if (!product) {
      throw this.notFound('Producto no encontrado');
    }
    return product;
  }

  private async findProductOrThrow(id: string): Promise<Product> {
    const product = await this.productModel.findOne({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw this.notFound('Producto no encontrado');
    }
    return product;
  }

  private async resolveCategoryIds(slug: string, locale: LocaleContext) {
    const translations = await this.categoryTranslationModel.findAll({
      where: { slug },
    });
    const translation =
      translations.find((row) => row.locale === locale.locale) ??
      translations.find((row) => row.locale === locale.defaultLocale) ??
      translations[0];

    if (!translation) {
      throw this.notFound('Categoría no encontrada');
    }

    const category = await this.categoryModel.findByPk(translation.categoryId);
    if (!category?.isActive) {
      throw this.notFound('Categoría no encontrada');
    }

    return [category.id];
  }

  private async assertCategoriesExist(
    categoryIds: string[],
    transaction: Transaction,
  ) {
    if (categoryIds.length === 0) {
      return;
    }
    const count = await this.categoryModel.count({
      where: { id: { [Op.in]: categoryIds } },
      transaction,
    });
    if (count !== categoryIds.length) {
      throw this.validationError('Alguna categoría no existe', [
        { field: 'categoryIds', issue: 'unknown_category' },
      ]);
    }
  }

  private assertVariantInput(input: CreateProductInput) {
    const variants = input.variants ?? [];

    if (input.type === 'SIMPLE' && variants.length > 1) {
      throw this.validationError(
        'Un producto SIMPLE admite una sola variante',
        [{ field: 'variants', issue: 'too_many_for_simple' }],
      );
    }

    if (input.type === 'SIMPLE' && variants[0]?.optionValueIds?.length) {
      throw this.validationError(
        'La variante de un producto SIMPLE no admite opciones',
        [
          {
            field: 'variants.0.optionValueIds',
            issue: 'not_allowed_for_simple',
          },
        ],
      );
    }
  }

  private async createProductTranslation(
    productId: string,
    input: TranslationInput,
    transaction: Transaction,
  ) {
    const slug = await this.resolveSlug(input, 'product', transaction);
    await this.productTranslationModel.create(
      {
        productId,
        locale: input.locale,
        name: input.name,
        slug,
        description: input.description ?? null,
      },
      { transaction },
    );
  }

  private async upsertProductTranslation(
    productId: string,
    input: TranslationInput,
    transaction: Transaction,
  ) {
    const existing = await this.productTranslationModel.findOne({
      where: { productId, locale: input.locale },
      transaction,
    });

    if (existing) {
      const slug = input.slug
        ? await this.checkSlugForUpdate(
            'product',
            input.slug,
            input.locale,
            transaction,
            existing.productId,
          )
        : existing.slug;
      await existing.update(
        {
          name: input.name,
          slug,
          description: input.description ?? existing.description,
        },
        { transaction },
      );
      return;
    }

    await this.createProductTranslation(productId, input, transaction);
  }

  private async createVariants(
    product: Product,
    input: CreateProductInput,
    transaction: Transaction,
  ) {
    const variants: VariantInput[] =
      product.type === 'SIMPLE'
        ? [
            {
              sku:
                input.variants?.[0]?.sku ??
                `SIMPLE-${product.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
              priceMinor: input.variants?.[0]?.priceMinor ?? null,
              initialStock: input.variants?.[0]?.initialStock ?? 0,
              allowBackorder: input.variants?.[0]?.allowBackorder ?? false,
              isActive: true,
            },
          ]
        : (input.variants ?? []);

    const combinations = new Set<string>();

    for (const variantInput of variants) {
      const optionValueIds = this.normalizeOptionValueIds(
        variantInput.optionValueIds ?? [],
        product.type,
      );
      const combinationKey =
        product.type === 'SIMPLE'
          ? 'default'
          : createHash('sha256').update(optionValueIds.join(':')).digest('hex');

      if (combinations.has(combinationKey)) {
        throw this.conflict(
          ErrorCode.VARIANT_COMBINATION_DUPLICATE,
          'La combinación de opciones está repetida en el producto',
          [{ field: 'variants', issue: 'duplicate_combination' }],
        );
      }
      combinations.add(combinationKey);

      const existingCombination = await this.variantModel.findOne({
        where: { productId: product.id, combinationKey },
        transaction,
      });
      if (existingCombination) {
        throw this.conflict(
          ErrorCode.VARIANT_COMBINATION_DUPLICATE,
          'La combinación de opciones está repetida en el producto',
          [{ field: 'variants', issue: 'duplicate_combination' }],
        );
      }

      const skuTaken = await this.variantModel.findOne({
        where: { sku: variantInput.sku },
        transaction,
      });
      if (skuTaken) {
        throw this.conflict(
          ErrorCode.SKU_ALREADY_EXISTS,
          'El SKU ya está en uso',
          [{ field: 'variants.sku', issue: 'already_exists' }],
        );
      }

      await this.assertOptionValues(optionValueIds, transaction);

      const variant = await this.variantModel.create(
        {
          productId: product.id,
          sku: variantInput.sku,
          priceMinor: variantInput.priceMinor ?? null,
          isDefault: product.type === 'SIMPLE',
          isActive: variantInput.isActive ?? true,
          combinationKey,
        },
        { transaction },
      );

      if (optionValueIds.length > 0) {
        await this.optionValueModel.bulkCreate(
          optionValueIds.map((attributeValueId) => ({
            variantId: variant.id,
            attributeValueId,
          })),
          { transaction },
        );
      }

      await this.inventoryService.initializeVariant(
        variant.id,
        variantInput.initialStock ?? 0,
        variantInput.allowBackorder ?? false,
        transaction,
      );
    }
  }

  private normalizeOptionValueIds(
    optionValueIds: string[],
    type: 'SIMPLE' | 'VARIABLE',
  ): string[] {
    if (type === 'SIMPLE') {
      return [];
    }
    if (optionValueIds.length === 0) {
      throw this.validationError(
        'Cada variante de un producto VARIABLE necesita al menos una opción',
        [{ field: 'variants.optionValueIds', issue: 'empty' }],
      );
    }
    return [...new Set(optionValueIds)].sort();
  }

  private async assertOptionValues(
    optionValueIds: string[],
    transaction: Transaction,
  ) {
    if (optionValueIds.length === 0) {
      return;
    }

    const values = await this.attributeValueModel.findAll({
      where: { id: { [Op.in]: optionValueIds } },
      transaction,
    });
    if (values.length !== optionValueIds.length) {
      throw this.validationError('Alguna opción de variante no existe', [
        { field: 'variants.optionValueIds', issue: 'unknown_value' },
      ]);
    }

    const distinctAttributes = new Set(
      values.map((value) => value.attributeId),
    );
    if (distinctAttributes.size !== values.length) {
      throw this.validationError(
        'Cada variante admite un solo valor por atributo',
        [{ field: 'variants.optionValueIds', issue: 'duplicate_attribute' }],
      );
    }

    const attributes = await this.attributeModel.findAll({
      where: { id: { [Op.in]: values.map((value) => value.attributeId) } },
      transaction,
    });
    const attributesById = new Map(
      attributes.map((attribute) => [attribute.id, attribute]),
    );

    for (const value of values) {
      if (!attributesById.get(value.attributeId)?.isVariantAxis) {
        throw this.validationError(
          'Las opciones deben pertenecer a atributos de variante',
          [{ field: 'variants.optionValueIds', issue: 'not_variant_axis' }],
        );
      }
    }
  }

  private async assertPublishable(product: Product) {
    const imageCount = await this.productImageModel.count({
      where: { productId: product.id },
    });
    if (imageCount === 0) {
      throw this.unprocessable(
        ErrorCode.PRODUCT_IMAGE_REQUIRED,
        'Un producto publicado necesita al menos una imagen',
      );
    }

    const locale = await this.localeService.resolve(undefined, undefined);
    const defaultTranslation = await this.productTranslationModel.findOne({
      where: { productId: product.id, locale: locale.defaultLocale },
    });
    if (!defaultTranslation) {
      throw this.unprocessable(
        ErrorCode.PRODUCT_DEFAULT_TRANSLATION_REQUIRED,
        `Falta la traducción en el idioma por defecto (${locale.defaultLocale})`,
      );
    }

    const activeVariants = await this.variantModel.count({
      where: { productId: product.id, isActive: true },
    });
    if (activeVariants === 0) {
      throw this.unprocessable(
        ErrorCode.PRODUCT_VARIANT_REQUIRED,
        'Un producto publicado necesita al menos una variante activa',
      );
    }
  }

  private async loadProductData(
    productIds: string[],
  ): Promise<LoadedProductData> {
    const empty: LoadedProductData = {
      translations: [],
      images: [],
      variants: [],
      categoryIds: [],
      categoryTranslations: [],
      optionValuesByVariant: new Map(),
      stock: new Map(),
    };
    if (productIds.length === 0) {
      return empty;
    }

    const [translations, images, variants, categoryLinks] = await Promise.all([
      this.productTranslationModel.findAll({
        where: { productId: { [Op.in]: productIds } },
      }),
      this.productImageModel.findAll({
        where: { productId: { [Op.in]: productIds } },
        order: [['position', 'ASC']],
      }),
      this.variantModel.findAll({
        where: { productId: { [Op.in]: productIds } },
        order: [['createdAt', 'ASC']],
      }),
      this.productCategoryModel.findAll({
        where: { productId: { [Op.in]: productIds } },
        raw: true,
      }),
    ]);

    const categoryIds = [
      ...new Set(categoryLinks.map((link) => link.categoryId)),
    ];
    const [optionValuesByVariant, stock, categoryTranslations] =
      await Promise.all([
        this.loadOptionValues(variants.map((variant) => variant.id)),
        this.inventoryService.getStockMap(
          variants.map((variant) => variant.id),
        ),
        categoryIds.length > 0
          ? this.categoryTranslationModel.findAll({
              where: { categoryId: { [Op.in]: categoryIds } },
            })
          : Promise.resolve([]),
      ]);

    return {
      translations,
      images,
      variants,
      categoryIds,
      categoryTranslations,
      optionValuesByVariant,
      stock,
    };
  }

  private async loadOptionValues(
    variantIds: string[],
  ): Promise<Map<string, OptionValueView[]>> {
    if (variantIds.length === 0) {
      return new Map();
    }

    const links = await this.optionValueModel.findAll({
      where: { variantId: { [Op.in]: variantIds } },
      raw: true,
    });
    const valueIds = [...new Set(links.map((link) => link.attributeValueId))];

    const [values, valueTranslations] = await Promise.all([
      this.attributeValueModel.findAll({
        where: { id: { [Op.in]: valueIds } },
        raw: true,
      }),
      this.attributeValueTranslationModel.findAll({
        where: { attributeValueId: { [Op.in]: valueIds } },
      }),
    ]);
    const attributes = await this.attributeModel.findAll({
      where: { id: { [Op.in]: values.map((value) => value.attributeId) } },
      raw: true,
    });

    const attributesById = new Map(
      attributes.map((attribute) => [attribute.id, attribute]),
    );

    const result = new Map<string, OptionValueView[]>();
    for (const link of links) {
      const value = values.find((row) => row.id === link.attributeValueId);
      if (!value) {
        continue;
      }
      const attribute = attributesById.get(value.attributeId);
      const translation = valueTranslations.find(
        (row) => row.attributeValueId === value.id,
      );
      const current = result.get(link.variantId) ?? [];
      current.push({
        attributeId: value.attributeId,
        attributeCode: attribute?.code ?? '',
        valueId: value.id,
        valueCode: value.code,
        valueName: translation?.name ?? value.code,
      });
      result.set(link.variantId, current);
    }

    return result;
  }

  private toPublicProduct(
    product: Product,
    data: LoadedProductData,
    locale: LocaleContext,
  ) {
    const translation = pickTranslation(
      data.translations.filter((row) => row.productId === product.id),
      locale.locale,
      locale.defaultLocale,
    );
    const activeVariants = data.variants.filter(
      (variant) => variant.productId === product.id && variant.isActive,
    );
    const variantViews = activeVariants.map((variant) =>
      this.toVariantView(product, variant, data),
    );
    const prices = variantViews.map((variant) => variant.priceMinor);

    return {
      id: product.id,
      type: product.type,
      name: translation?.name ?? null,
      slug: translation?.slug ?? null,
      description: translation?.description ?? null,
      basePriceMinor: product.basePriceMinor,
      priceMinor:
        prices.length > 0 ? Math.min(...prices) : product.basePriceMinor,
      categories: this.toCategoryViews(data, locale),
      images: data.images
        .filter((image) => image.productId === product.id)
        .map((image) => ({
          id: image.id,
          alt: image.alt,
          position: image.position,
          ...this.imageService.toPublicUrls(image.storageKey),
        })),
      variants: variantViews,
      available: variantViews.some((variant) => variant.available),
    };
  }

  private toAdminProduct(product: Product, data: LoadedProductData) {
    const locale: LocaleContext = {
      locale: 'es',
      defaultLocale: 'es',
      activeLocales: ['es'],
    };

    return {
      id: product.id,
      status: product.status,
      type: product.type,
      basePriceMinor: product.basePriceMinor,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      translations: data.translations
        .filter((translation) => translation.productId === product.id)
        .map((translation) => ({
          locale: translation.locale,
          name: translation.name,
          slug: translation.slug,
          description: translation.description,
        })),
      categories: this.toCategoryViews(data, locale),
      images: data.images
        .filter((image) => image.productId === product.id)
        .map((image) => ({
          id: image.id,
          alt: image.alt,
          position: image.position,
          ...this.imageService.toPublicUrls(image.storageKey),
        })),
      variants: data.variants
        .filter((variant) => variant.productId === product.id)
        .map((variant) => {
          const stock = data.stock.get(variant.id);
          return {
            ...this.toVariantView(product, variant, data),
            isActive: variant.isActive,
            quantity: stock?.quantity ?? 0,
            allowBackorder: stock?.allowBackorder ?? false,
          };
        }),
    };
  }

  private toVariantView(
    product: Product,
    variant: ProductVariant,
    data: LoadedProductData,
  ) {
    const stock = data.stock.get(variant.id);
    return {
      id: variant.id,
      sku: variant.sku,
      isDefault: variant.isDefault,
      priceMinor: variant.priceMinor ?? product.basePriceMinor,
      options: (data.optionValuesByVariant.get(variant.id) ?? []).map(
        (option) => ({
          attributeCode: option.attributeCode,
          valueCode: option.valueCode,
          valueName: option.valueName,
        }),
      ),
      available: (stock?.allowBackorder ?? false) || (stock?.quantity ?? 0) > 0,
    };
  }

  private toCategoryViews(data: LoadedProductData, locale: LocaleContext) {
    return data.categoryIds.map((categoryId) => {
      const translation = pickTranslation(
        data.categoryTranslations.filter(
          (row) => row.categoryId === categoryId,
        ),
        locale.locale,
        locale.defaultLocale,
      );
      return {
        id: categoryId,
        slug: translation?.slug ?? null,
        name: translation?.name ?? null,
      };
    });
  }

  private assertUniqueLocales(translations: { locale: string }[]) {
    const seen = new Set<string>();
    translations.forEach((translation, index) => {
      if (seen.has(translation.locale)) {
        throw this.validationError(
          'Hay traducciones repetidas para el mismo idioma',
          [
            {
              field: `translations.${index}.locale`,
              issue: 'duplicate_locale',
            },
          ],
        );
      }
      seen.add(translation.locale);
    });
  }

  private async resolveSlug(
    input: TranslationInput,
    entity: 'product' | 'category',
    transaction: Transaction,
  ): Promise<string> {
    if (input.slug) {
      if (
        await this.slugExists(entity, input.slug, input.locale, transaction)
      ) {
        throw this.conflict(
          ErrorCode.SLUG_ALREADY_EXISTS,
          'El slug ya está en uso para ese idioma',
          [{ field: 'slug', issue: 'already_exists' }],
        );
      }
      return input.slug;
    }

    const maxLength = entity === 'product' ? 180 : 160;
    const base = slugify(input.name).slice(0, maxLength);
    let candidate = base;
    let suffix = 2;

    while (
      await this.slugExists(entity, candidate, input.locale, transaction)
    ) {
      const suffixText = `-${suffix}`;
      candidate = `${base.slice(0, maxLength - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    return candidate;
  }

  private async slugExists(
    entity: 'product' | 'category',
    slug: string,
    locale: string,
    transaction: Transaction,
  ): Promise<boolean> {
    if (entity === 'product') {
      const row = await this.productTranslationModel.findOne({
        where: { slug, locale },
        transaction,
      });
      return Boolean(row);
    }
    const row = await this.categoryTranslationModel.findOne({
      where: { slug, locale },
      transaction,
    });
    return Boolean(row);
  }

  private async createCategoryTranslation(
    categoryId: string,
    input: TranslationInput,
    transaction: Transaction,
  ) {
    const slug = await this.resolveSlug(input, 'category', transaction);
    await this.categoryTranslationModel.create(
      {
        categoryId,
        locale: input.locale,
        name: input.name,
        slug,
        description: input.description ?? null,
      },
      { transaction },
    );
  }

  private async upsertCategoryTranslation(
    categoryId: string,
    input: TranslationInput,
    transaction: Transaction,
  ) {
    const existing = await this.categoryTranslationModel.findOne({
      where: { categoryId, locale: input.locale },
      transaction,
    });

    if (existing) {
      const slug = input.slug
        ? await this.checkSlugForUpdate(
            'category',
            input.slug,
            input.locale,
            transaction,
            categoryId,
          )
        : existing.slug;
      await existing.update(
        {
          name: input.name,
          slug,
          description: input.description ?? existing.description,
        },
        { transaction },
      );
      return;
    }

    await this.createCategoryTranslation(categoryId, input, transaction);
  }

  private async checkSlugForUpdate(
    entity: 'product' | 'category',
    slug: string,
    locale: string,
    transaction: Transaction,
    entityId: string,
  ): Promise<string> {
    const row =
      entity === 'product'
        ? await this.productTranslationModel.findOne({
            where: { slug, locale, productId: { [Op.ne]: entityId } },
            transaction,
          })
        : await this.categoryTranslationModel.findOne({
            where: { slug, locale, categoryId: { [Op.ne]: entityId } },
            transaction,
          });

    if (row) {
      throw this.conflict(
        ErrorCode.SLUG_ALREADY_EXISTS,
        'El slug ya está en uso para ese idioma',
        [{ field: 'slug', issue: 'already_exists' }],
      );
    }

    return slug;
  }

  private validationError(
    message: string,
    details?: { field: string; issue: string }[],
  ) {
    return new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.VALIDATION_ERROR,
      message,
      details,
    );
  }

  private notFound(message: string) {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message);
  }

  private conflict(
    code: ErrorCodeValue,
    message: string,
    details?: { field: string; issue: string }[],
  ) {
    return new AppException(HttpStatus.CONFLICT, code, message, details);
  }

  private unprocessable(
    code: ErrorCodeValue,
    message: string,
    details?: { field: string; issue: string }[],
  ) {
    return new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      code,
      message,
      details,
    );
  }
}

type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
