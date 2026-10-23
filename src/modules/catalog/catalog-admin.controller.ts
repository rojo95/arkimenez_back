import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import {
  addImageSchema,
  adminProductsQuerySchema,
  attributeValueParamSchema,
  attributeValueUpdateParamSchema,
  createAttributeSchema,
  createAttributeValueSchema,
  createCategorySchema,
  createProductSchema,
  productIdParamSchema,
  productImageParamSchema,
  productVariantParamSchema,
  publicLocaleQuerySchema,
  updateAttributeSchema,
  updateAttributeValueSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
  uuidParamSchema,
} from './catalog.schemas';
import { CatalogService } from './catalog.service';
import type {
  AdminProductsQuery,
  CreateAttributeInput,
  CreateAttributeValueInput,
  CreateCategoryInput,
  CreateProductInput,
  UpdateAttributeInput,
  UpdateAttributeValueInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from './catalog.types';

interface LocaleQuery {
  locale?: string;
}

@ApiTags('admin/catalog')
@ApiBearerAuth()
@Controller('admin')
export class CatalogAdminController {
  constructor(private readonly catalogService: CatalogService) {}

  // Productos ---------------------------------------------------------------

  @Get('products')
  @RequirePermissions('product:read_admin')
  @ApiOperation({ summary: 'Lista productos para administración' })
  listProducts(
    @Query(new JoiValidationPipe(adminProductsQuerySchema))
    query: AdminProductsQuery,
  ) {
    return this.catalogService.listAdminProducts(query);
  }

  @Get('products/:id')
  @RequirePermissions('product:read_admin')
  @ApiOperation({ summary: 'Obtiene un producto para administración' })
  getProduct(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
  ) {
    return this.catalogService.getAdminProduct(params.id);
  }

  @Post('products')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Crea un producto en estado DRAFT' })
  createProduct(
    @Body(new JoiValidationPipe(createProductSchema)) body: CreateProductInput,
  ) {
    return this.catalogService.createProduct(body);
  }

  @Patch('products/:id')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Actualiza datos base, traducciones y categorías' })
  updateProduct(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new JoiValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    return this.catalogService.updateProduct(params.id, body);
  }

  @Patch('products/:productId/variants/:variantId')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Actualiza precio o estado de una variante' })
  updateVariant(
    @Param(new JoiValidationPipe(productVariantParamSchema))
    params: { productId: string; variantId: string },
    @Body(new JoiValidationPipe(updateVariantSchema)) body: UpdateVariantInput,
  ) {
    return this.catalogService.updateVariant(
      params.productId,
      params.variantId,
      body,
    );
  }

  @Post('products/:id/publish')
  @RequirePermissions('product:publish')
  @ApiOperation({ summary: 'Publica un producto que cumple las reglas' })
  publish(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
  ) {
    return this.catalogService.changeStatus(params.id, 'PUBLISHED');
  }

  @Post('products/:id/unpublish')
  @RequirePermissions('product:publish')
  @ApiOperation({ summary: 'Devuelve un producto publicado a borrador' })
  unpublish(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
  ) {
    return this.catalogService.changeStatus(params.id, 'DRAFT');
  }

  @Post('products/:id/archive')
  @RequirePermissions('product:publish')
  @ApiOperation({ summary: 'Archiva un producto' })
  archive(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
  ) {
    return this.catalogService.changeStatus(params.id, 'ARCHIVED');
  }

  // Imágenes ----------------------------------------------------------------

  @Post('products/:productId/images')
  @RequirePermissions('product:write')
  @UseInterceptors(
    // Límite duro de multer; el límite real lo aplica ImageService con
    // MAX_IMAGE_SIZE_MB (máximo validado: 20 MB).
    FileInterceptor('image', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Sube y procesa una imagen de producto' })
  addImage(
    @Param(new JoiValidationPipe(productIdParamSchema))
    params: { productId: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new JoiValidationPipe(addImageSchema)) body: { alt?: string },
  ) {
    if (!file) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Falta la imagen',
        [{ field: 'image', issue: 'required' }],
      );
    }
    return this.catalogService.addImage(params.productId, file, body.alt);
  }

  @Delete('products/:productId/images/:imageId')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Elimina una imagen de producto' })
  removeImage(
    @Param(new JoiValidationPipe(productImageParamSchema))
    params: {
      productId: string;
      imageId: string;
    },
  ) {
    return this.catalogService.removeImage(params.productId, params.imageId);
  }

  // Categorías --------------------------------------------------------------

  @Get('categories')
  @RequirePermissions('product:read_admin')
  @ApiOperation({ summary: 'Lista todas las categorías con sus traducciones' })
  listCategories() {
    return this.catalogService.listAdminCategories();
  }

  @Post('categories')
  @RequirePermissions('category:write')
  @ApiOperation({ summary: 'Crea una categoría' })
  createCategory(
    @Body(new JoiValidationPipe(createCategorySchema))
    body: CreateCategoryInput,
  ) {
    return this.catalogService.createCategory(body);
  }

  @Patch('categories/:id')
  @RequirePermissions('category:write')
  @ApiOperation({ summary: 'Actualiza una categoría' })
  updateCategory(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new JoiValidationPipe(updateCategorySchema))
    body: UpdateCategoryInput,
  ) {
    return this.catalogService.updateCategory(params.id, body);
  }

  // Atributos ---------------------------------------------------------------

  @Get('attributes')
  @RequirePermissions('product:read_admin')
  @ApiOperation({ summary: 'Lista atributos y valores' })
  listAttributes(
    @Query(new JoiValidationPipe(publicLocaleQuerySchema)) query: LocaleQuery,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.listPublicAttributes(
      query.locale,
      acceptLanguage,
    );
  }

  @Post('attributes')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Crea un atributo' })
  createAttribute(
    @Body(new JoiValidationPipe(createAttributeSchema))
    body: CreateAttributeInput,
  ) {
    return this.catalogService.createAttribute(body);
  }

  @Patch('attributes/:id')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Actualiza un atributo' })
  updateAttribute(
    @Param(new JoiValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new JoiValidationPipe(updateAttributeSchema))
    body: UpdateAttributeInput,
  ) {
    return this.catalogService.updateAttribute(params.id, body);
  }

  @Post('attributes/:attributeId/values')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Crea un valor de atributo' })
  createAttributeValue(
    @Param(new JoiValidationPipe(attributeValueParamSchema))
    params: { attributeId: string },
    @Body(new JoiValidationPipe(createAttributeValueSchema))
    body: CreateAttributeValueInput,
  ) {
    return this.catalogService.createAttributeValue(params.attributeId, body);
  }

  @Patch('attributes/:attributeId/values/:valueId')
  @RequirePermissions('product:write')
  @ApiOperation({ summary: 'Actualiza las traducciones de un valor' })
  updateAttributeValue(
    @Param(new JoiValidationPipe(attributeValueUpdateParamSchema))
    params: { attributeId: string; valueId: string },
    @Body(new JoiValidationPipe(updateAttributeValueSchema))
    body: UpdateAttributeValueInput,
  ) {
    return this.catalogService.updateAttributeValue(
      params.attributeId,
      params.valueId,
      body,
    );
  }
}
