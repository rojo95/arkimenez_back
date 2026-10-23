import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { JoiValidationPipe } from '../../shared/pipes/joi-validation.pipe';
import {
  listProductsQuerySchema,
  productIdentifierParamSchema,
  publicLocaleQuerySchema,
} from './catalog.schemas';
import { CatalogService } from './catalog.service';
import type { ListProductsQuery } from './catalog.types';

interface LocaleQuery {
  locale?: string;
}

@ApiTags('catalog')
@Public()
@Controller()
export class CatalogPublicController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Lista productos publicados con filtros y paginación',
  })
  listProducts(
    @Query(new JoiValidationPipe(listProductsQuerySchema))
    query: ListProductsQuery,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.listPublicProducts(query, acceptLanguage);
  }

  @Get('products/:slugOrId')
  @ApiOperation({ summary: 'Obtiene un producto publicado por slug o id' })
  getProduct(
    @Param(new JoiValidationPipe(productIdentifierParamSchema))
    params: { slugOrId: string },
    @Query(new JoiValidationPipe(publicLocaleQuerySchema)) query: LocaleQuery,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.getPublicProduct(
      params.slugOrId,
      query.locale,
      acceptLanguage,
    );
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lista las categorías activas' })
  listCategories(
    @Query(new JoiValidationPipe(publicLocaleQuerySchema)) query: LocaleQuery,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.listPublicCategories(
      query.locale,
      acceptLanguage,
    );
  }

  @Get('attributes')
  @ApiOperation({ summary: 'Lista atributos y valores para filtros' })
  listAttributes(
    @Query(new JoiValidationPipe(publicLocaleQuerySchema)) query: LocaleQuery,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.catalogService.listPublicAttributes(
      query.locale,
      acceptLanguage,
    );
  }
}
