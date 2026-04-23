import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(partnerId: string, distributorId: string, amount: number, notes?: string) {
    return this.prisma.settlement.create({
      data: {
        partnerId,
        distributorId,
        amount,
        notes,
        status: 'PENDING',
      },
    });
  }

  async verify(id: string, distributorId: string) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.distributorId !== distributorId) {
      throw new BadRequestException('Unauthorized verification');
    }
    if (settlement.status === 'VERIFIED') {
      throw new BadRequestException('Already verified');
    }

    return this.prisma.settlement.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });
  }

  async findAll(filters: { partnerId?: string; distributorId?: string; status?: any }) {
    return this.prisma.settlement.findMany({
      where: {
        ...(filters.partnerId && { partnerId: filters.partnerId }),
        ...(filters.distributorId && { distributorId: filters.distributorId }),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        deliveryPartner: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
