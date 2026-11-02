import { Module } from '@nestjs/common';
import { BiodropsController } from './biodrops.controller';
import { BiodropsService } from './biodrops.service';
import { BiodropsRoleGuard } from './biodrops-role.guard';

@Module({
  controllers: [BiodropsController],
  providers: [BiodropsService, BiodropsRoleGuard],
  exports: [BiodropsService, BiodropsRoleGuard],
})
export class BiodropsModule {}

