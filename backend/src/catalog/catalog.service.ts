import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // =====================
  // BRANDS
  // =====================
  async getBrands() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBrandById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async createBrand(dto: CreateBrandDto) {
    return this.prisma.brand.create({
      data: dto,
    });
  }

  async updateBrand(id: string, dto: UpdateBrandDto) {
    return this.prisma.brand.update({
      where: { id },
      data: dto,
    });
  }

  async deleteBrand(id: string) {
    return this.prisma.brand.delete({
      where: { id },
    });
  }

  // =====================
  // CATEGORIES
  // =====================
  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: dto,
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  // =====================
  // PRODUCTS
  // =====================
  async getProducts(params: {
    categoryId?: string;
    brandId?: string;
    isJar?: boolean;
    search?: string;
  }) {
    const { categoryId, brandId, isJar, search } = params;

    return this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        ...(categoryId && { categoryId }),
        ...(brandId && { brandId }),
        ...(isJar !== undefined && { isJar }),
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
      },
      include: {
        brand: true,
        category: true,
        images: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        images: true,
        stock: {
          include: { warehouse: true },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const { imageUrl, ...productData } = dto;
    
    return this.prisma.product.create({
      data: {
        ...productData,
        images: imageUrl ? {
          create: [{ url: imageUrl, isPrimary: true }]
        } : undefined
      },
      include: {
        images: true,
      }
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const { imageUrl, ...productData } = dto;
    
    // First update product base data
    const updated = await this.prisma.product.update({
      where: { id },
      data: productData,
    });

    // If a new image was uploaded, we can add it or replace existing
    if (imageUrl) {
      await this.prisma.productImage.deleteMany({ where: { productId: id }});
      await this.prisma.productImage.create({
        data: {
          productId: id,
          url: imageUrl,
          isPrimary: true,
        }
      });
    }

    return this.getProductById(id);
  }

  async deleteProduct(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
