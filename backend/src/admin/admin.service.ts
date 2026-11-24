import { Injectable, Logger } from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async triggerGlobalRefresh(user?: any) {
    const payload = {
      timestamp: new Date().toISOString(),
      triggeredBy: user?.name || user?.email || 'Super Admin',
      message: 'System data synchronized by administrator',
    };

    this.logger.log(`Broadcasting SYSTEM_GLOBAL_REFRESH triggered by ${payload.triggeredBy}`);
    // Emit to all connected sockets across the entire cluster
    this.eventsGateway.server.emit('system:global-refresh', payload);

    return {
      success: true,
      broadcastMessage: 'Global refresh broadcast emitted to all connected users, distributors, and staff.',
      ...payload,
    };
  }

  create(createAdminDto: CreateAdminDto) {
    return this.prisma.admin.create({ data: createAdminDto as any });
  }

  findAll() {
    return this.prisma.admin.findMany({ include: { user: true }, take: 100 });
  }

  findOne(id: string | number) {
    return this.prisma.admin.findUnique({
      where: { id: String(id) },
      include: { user: true },
    });
  }

  update(id: string | number, updateAdminDto: UpdateAdminDto) {
    return this.prisma.admin.update({
      where: { id: String(id) },
      data: updateAdminDto as any,
    });
  }

  remove(id: string | number) {
    return this.prisma.admin.delete({ where: { id: String(id) } });
  }
}
