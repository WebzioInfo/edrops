import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BiodropsService } from './biodrops.service';
import { BiodropsController } from './biodrops.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BiodropsController],
  providers: [BiodropsService],
  exports: [BiodropsService],
})
export class BiodropsEcosystemModule {}
