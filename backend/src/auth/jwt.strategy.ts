import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customer: true },
    });

    if (!user || !user.isActive || user.accountStatus === AccountStatus.DISABLED) {
      throw new UnauthorizedException('Account is inactive or disabled');
    }

    return {
      id: user.id,
      sub: user.id,
      customerId: user.customer?.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      avatarUrl: user.avatarUrl || null,
    };
  }
}
