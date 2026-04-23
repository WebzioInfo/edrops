import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JarStatus } from '@prisma/client';

@Injectable()
export class JarsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(productId: string, quantity: number) {
    const jars = [];
    for (let i = 0; i < quantity; i++) {
        const serialNumber = `JAR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        jars.push({
            serialNumber,
            productId,
            status: 'IN_GODOWN' as JarStatus,
        });
    }

    return this.prisma.jar.createMany({
        data: jars,
    });
  }

  async updateStatus(serialNumber: string, status: JarStatus, customerId?: string, orderId?: string, notes?: string) {
    const jar = await this.prisma.jar.findUnique({ where: { serialNumber } });
    if (!jar) throw new NotFoundException('Jar not found');

    const [updatedJar] = await this.prisma.$transaction([
        this.prisma.jar.update({
            where: { serialNumber },
            data: { status, customerId },
        }),
        this.prisma.jarLifecycle.create({
            data: {
                jarId: jar.id,
                customerId: customerId || jar.customerId || 'SYSTEM',
                orderId,
                action: status,
                notes,
            }
        })
    ]);

    return updatedJar;
  }

  async getCustomerJarBalance(customerId: string) {
    const jarsHeld = await this.prisma.jar.count({
        where: { customerId, status: 'WITH_CUSTOMER' as JarStatus }
    });

    const totalDeposit = await this.prisma.jar.aggregate({
        where: { customerId, status: 'WITH_CUSTOMER' as JarStatus },
        _sum: { depositPaid: true }
    });

    return {
        jarsHeld,
        totalDeposit: totalDeposit._sum.depositPaid || 0,
    };
  }

  async recordManualCollection(customerId: string, quantity: number, notes?: string) {
      // For non-serialized jar collections (old jars)
      return this.prisma.jarLifecycle.create({
          data: {
              customerId,
              action: 'COLLECTED',
              quantity,
              notes: notes || 'Manual bulk collection',
          }
      });
  }
}
