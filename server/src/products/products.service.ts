import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Brands ───────────────────────────────────────────────────────────────
  async getAllBrands() {
    return this.prisma.brand.findMany({
      where: { deletedAt: null, isActive: true },
      include: { _count: { select: { products: true } } },
    });
  }

  async createBrand(data: { name: string; logo?: string; description?: string }) {
    return this.prisma.brand.create({ data });
  }

  // ─── Products ──────────────────────────────────────────────────────────────
  async findAll(brandId?: string) {
    return this.prisma.product.findMany({
      where: { deletedAt: null, isActive: true, ...(brandId && { brandId }) },
      include: { brand: { select: { id: true, name: true, logo: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { brand: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(data: {
    brandId: string;
    name: string;
    description?: string;
    sku: string;
    price: number;
    deposit?: number;
    imageUrl?: string;
    weightLitre?: number;
    isJar?: boolean;
  }) {
    return this.prisma.product.create({ data });
  }

  async update(id: string, data: Partial<{
    name: string; description: string; price: number;
    deposit: number; imageUrl: string; isActive: boolean;
  }>) {
    await this.findById(id);
    return this.prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
