import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';

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
}
