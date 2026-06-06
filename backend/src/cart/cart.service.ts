import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncCartDto } from './dto/sync-cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(customerId: string) {
    return this.prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                images: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async syncCart(customerId: string, dto: SyncCartDto) {
    const mergedItems = new Map<string, number>();
    for (const item of dto.items) {
      mergedItems.set(
        item.productId,
        (mergedItems.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productIds = [...mergedItems.keys()];
    if (productIds.length === 0) {
      await this.prisma.cart.upsert({
        where: { customerId },
        create: { customerId },
        update: {},
      });
      await this.prisma.cartItem.deleteMany({
        where: { cart: { customerId } },
      });
      return this.getCart(customerId);
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, status: true, name: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more cart products no longer exist');
    }

    const inactiveProduct = products.find(
      (product) => product.status !== ProductStatus.ACTIVE,
    );
    if (inactiveProduct) {
      throw new BadRequestException(
        `Product ${inactiveProduct.name} is not available`,
      );
    }

    const cart = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cart.upsert({
        where: { customerId },
        create: { customerId },
        update: {},
      });

      await tx.cartItem.deleteMany({ where: { cartId: existing.id } });
      await tx.cartItem.createMany({
        data: [...mergedItems.entries()].map(([productId, quantity]) => ({
          cartId: existing.id,
          productId,
          quantity,
        })),
      });

      return existing;
    });

    return this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                images: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async addItem(customerId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, name: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException(`Product ${product.name} is not available`);
    }

    const cart = await this.prisma.cart.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
    });

    if (quantity < 1) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    } else {
      const existing = await this.prisma.cartItem.findFirst({
        where: { cartId: cart.id, productId },
      });
      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: { cartId: cart.id, productId, quantity },
        });
      }
    }

    return this.getCart(customerId);
  }

  async removeItem(customerId: string, productId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { customerId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }
    return this.getCart(customerId);
  }

  async clearCart(customerId: string) {
    await this.prisma.cartItem.deleteMany({ where: { cart: { customerId } } });
    return { success: true };
  }
}
