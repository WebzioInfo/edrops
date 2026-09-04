import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { multerOptions } from '../config/multer.config';
import type { MulterFile } from '../config/cloudinary.service';
import { CatalogService } from './catalog.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // =====================
  // BRANDS
  // =====================
  @Get('brands')
  async getBrands() {
    return this.catalogService.getBrands();
  }

  @Post('brands')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async createBrand(
    @Body() dto: CreateBrandDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.catalogService.createBrand(dto, file);
  }

  @Patch('brands/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async updateBrand(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.catalogService.updateBrand(id, dto, file);
  }

  @Delete('brands/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteBrand(@Param('id') id: string) {
    return this.catalogService.deleteBrand(id);
  }

  @Get('brands/:id')
  async getBrandById(@Param('id') id: string) {
    return this.catalogService.getBrandById(id);
  }

  // =====================
  // CATEGORIES
  // =====================
  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Post('categories')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.catalogService.createCategory(dto, file);
  }

  @Patch('categories/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.catalogService.updateCategory(id, dto, file);
  }

  @Delete('categories/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCategory(@Param('id') id: string) {
    return this.catalogService.deleteCategory(id);
  }

  @Get('categories/:id')
  async getCategoryById(@Param('id') id: string) {
    return this.catalogService.getCategoryById(id);
  }

  // =====================
  // PRODUCTS
  // =====================
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

  @Post('products')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async createProduct(
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.catalogService.createProduct(dto, file);
  }

  @Patch('products/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.catalogService.updateProduct(id, dto, file);
  }

  @Delete('products/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteProduct(@Param('id') id: string) {
    return this.catalogService.deleteProduct(id);
  }

  @Get('products/:id')
  async getProductById(@Param('id') id: string) {
    return this.catalogService.getProductById(id);
  }
}
