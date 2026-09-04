import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';
import { CloudinaryService, type MulterFile } from '../config/cloudinary.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // =====================
  // BRANDS
  // =====================
  async getBrands() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getBrandById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async createBrand(dto: CreateBrandDto, file?: MulterFile) {
    if (file) {
      const upload = await this.cloudinaryService.uploadImage(file, 'edrops/brands');
      dto.logoUrl = upload.secure_url;
    }

    return this.prisma.brand.create({
      data: dto,
    });
  }

  async updateBrand(id: string, dto: UpdateBrandDto, file?: MulterFile) {
    const existing = await this.getBrandById(id);

    if (file) {
      const upload = await this.cloudinaryService.uploadImage(file, 'edrops/brands');
      dto.logoUrl = upload.secure_url;

      // Clean up old Cloudinary asset if replaced
      if (existing.logoUrl && existing.logoUrl !== upload.secure_url) {
        this.cloudinaryService.deleteImage(existing.logoUrl).catch((err) => {
          this.logger.warn(`Failed to clean up old brand logo: ${err.message}`);
        });
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: dto,
    });
  }

  async deleteBrand(id: string) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (existing?.logoUrl) {
      this.cloudinaryService.deleteImage(existing.logoUrl).catch(() => {});
    }

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
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async createCategory(dto: CreateCategoryDto, file?: MulterFile) {
    if (file) {
      const upload = await this.cloudinaryService.uploadImage(file, 'edrops/categories');
      dto.imageUrl = upload.secure_url;
    }

    return this.prisma.category.create({
      data: dto,
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, file?: MulterFile) {
    const existing = await this.getCategoryById(id);

    if (file) {
      const upload = await this.cloudinaryService.uploadImage(file, 'edrops/categories');
      dto.imageUrl = upload.secure_url;

      // Clean up old Cloudinary asset if replaced
      if (existing.imageUrl && existing.imageUrl !== upload.secure_url) {
        this.cloudinaryService.deleteImage(existing.imageUrl).catch((err) => {
          this.logger.warn(`Failed to clean up old category image: ${err.message}`);
        });
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (existing?.imageUrl) {
      this.cloudinaryService.deleteImage(existing.imageUrl).catch(() => {});
    }

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

  async createProduct(dto: CreateProductDto, file?: MulterFile) {
    let imageUrl = dto.imageUrl;

    if (file) {
      const upload = await this.cloudinaryService.uploadImage(file, 'edrops/products');
      imageUrl = upload.secure_url;
    }

    const { imageUrl: _, ...productData } = dto;

    return this.prisma.product.create({
      data: {
        ...productData,
        images: imageUrl
          ? {
              create: [{ url: imageUrl, isPrimary: true }],
            }
          : undefined,
      },
      include: {
        brand: true,
        category: true,
        images: true,
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto, file?: MulterFile) {
    const existing = await this.getProductById(id);
    let imageUrl = dto.imageUrl;

    if (file) {
      const upload = await this.cloudinaryService.uploadImage(file, 'edrops/products');
      imageUrl = upload.secure_url;

      // Clean up previous Cloudinary images if new image uploaded
      if (existing.images && existing.images.length > 0) {
        for (const img of existing.images) {
          if (img.url && img.url !== upload.secure_url) {
            this.cloudinaryService.deleteImage(img.url).catch((err) => {
              this.logger.warn(`Failed to clean up old product image: ${err.message}`);
            });
          }
        }
      }
    }

    const { imageUrl: _, ...productData } = dto;

    // First update product base properties
    await this.prisma.product.update({
      where: { id },
      data: productData,
    });

    // If new image URL was established, replace primary image
    if (imageUrl) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      await this.prisma.productImage.create({
        data: {
          productId: id,
          url: imageUrl,
          isPrimary: true,
        },
      });
    }

    return this.getProductById(id);
  }

  async deleteProduct(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (existing?.images && existing.images.length > 0) {
      for (const img of existing.images) {
        if (img.url) {
          this.cloudinaryService.deleteImage(img.url).catch(() => {});
        }
      }
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
