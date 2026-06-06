import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('brands')
  async getBrands() {
    return this.catalogService.getBrands();
  }

  @Get('brands/:id')
  async getBrandById(@Param('id') id: string) {
    return this.catalogService.getBrandById(id);
  }

  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('categories/:id')
  async getCategoryById(@Param('id') id: string) {
    return this.catalogService.getCategoryById(id);
  }

  @Get('products')
  async getProducts(
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('isJar') isJar?: string,
    @Query('search') search?: string,
  ) {
    const isJarBool = isJar !== undefined ? isJar === 'true' : undefined;
    return this.catalogService.getProducts({
      categoryId,
      brandId,
      isJar: isJarBool,
      search,
    });
  }

  @Get('products/:id')
  async getProductById(@Param('id') id: string) {
    return this.catalogService.getProductById(id);
  }
}
