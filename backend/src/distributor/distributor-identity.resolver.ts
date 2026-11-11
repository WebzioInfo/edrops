import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface ResolvedDistributorIdentity {
  userId: string;
  distributorId: string;
  agencyName: string;
  routeOrArea?: string | null;
  jarDepositRate: number;
  companyOwnedJars: number;
  distributorOwnedJars: number;
  canManufacture: boolean;
  isAdminImpersonation: boolean;
}

@Injectable()
export class DistributorIdentityResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the authoritative distributor identity from the caller's JWT user session.
   * If caller is DISTRIBUTOR: strictly binds to their own account.
   * If caller is ADMIN: permits inspecting a specific distributorId via explicit parameter.
   */
  async resolve(
    caller: { id?: string; sub?: string; role?: string },
    explicitDistributorId?: string,
  ): Promise<ResolvedDistributorIdentity> {
    const callerUserId = caller?.id || caller?.sub;
    if (!callerUserId) {
      throw new UnauthorizedException('Authentication session is missing user identifier.');
    }

    const callerRole = String(caller?.role || '').toUpperCase();

    // 1. If caller is an ADMIN and provided an explicit distributorId
    if (
      (callerRole === UserRole.ADMIN || callerRole === 'SUPER_ADMIN') &&
      explicitDistributorId?.trim()
    ) {
      const dist = await this.prisma.distributor.findFirst({
        where: {
          OR: [
            { id: explicitDistributorId.trim() },
            { userId: explicitDistributorId.trim() },
          ],
        },
        include: { user: true },
      });

      if (!dist) {
        throw new NotFoundException(
          `Distributor not found with identifier "${explicitDistributorId}".`,
        );
      }

      return {
        userId: dist.userId,
        distributorId: dist.id,
        agencyName: dist.agencyName || `${dist.user?.firstName || ''} ${dist.user?.lastName || ''}`.trim() || 'Distributor Agency',
        routeOrArea: dist.routeOrArea,
        jarDepositRate: Number(dist.jarDepositRate) || 150.0,
        companyOwnedJars: dist.companyOwnedJars || 0,
        distributorOwnedJars: dist.distributorOwnedJars || 0,
        canManufacture: dist.canManufacture || false,
        isAdminImpersonation: true,
      };
    }

    // 2. Standard Distributor caller: Strictly resolve from their own userId
    const distributor = await this.prisma.distributor.findUnique({
      where: { userId: callerUserId },
      include: { user: true },
    });

    if (!distributor) {
      // If user has role DISTRIBUTOR but profile does not exist yet, auto-provision profile
      const user = await this.prisma.user.findUnique({
        where: { id: callerUserId },
      });

      if (!user || user.role !== UserRole.DISTRIBUTOR) {
        throw new ForbiddenException(
          'Access denied. Only registered distributors or administrators can access distributor financial records.',
        );
      }

      const newDistributor = await this.prisma.distributor.create({
        data: {
          userId: user.id,
          referralCode: `DST-${user.phone?.slice(-4) || Date.now().toString().slice(-4)}`,
          agencyName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'My Distribution Agency',
          jarDepositRate: 150.0,
        },
        include: { user: true },
      });

      return {
        userId: newDistributor.userId,
        distributorId: newDistributor.id,
        agencyName: newDistributor.agencyName || 'Distribution Agency',
        routeOrArea: newDistributor.routeOrArea,
        jarDepositRate: Number(newDistributor.jarDepositRate) || 150.0,
        companyOwnedJars: newDistributor.companyOwnedJars || 0,
        distributorOwnedJars: newDistributor.distributorOwnedJars || 0,
        canManufacture: newDistributor.canManufacture || false,
        isAdminImpersonation: false,
      };
    }

    return {
      userId: distributor.userId,
      distributorId: distributor.id,
      agencyName: distributor.agencyName || `${distributor.user?.firstName || ''} ${distributor.user?.lastName || ''}`.trim() || 'Distributor Agency',
      routeOrArea: distributor.routeOrArea,
      jarDepositRate: Number(distributor.jarDepositRate) || 150.0,
      companyOwnedJars: distributor.companyOwnedJars || 0,
      distributorOwnedJars: distributor.distributorOwnedJars || 0,
      canManufacture: distributor.canManufacture || false,
      isAdminImpersonation: false,
    };
  }
}
