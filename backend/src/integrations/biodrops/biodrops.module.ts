import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { BiodropsController } from './biodrops.controller';
import { BiodropsService } from './biodrops.service';
import { BiodropsRoleGuard } from './biodrops-role.guard';

@Module({
  imports: [ConfigModule],
  controllers: [BiodropsController],
  providers: [BiodropsService, BiodropsRoleGuard],
  exports: [BiodropsService, BiodropsRoleGuard],
})
export class BiodropsModule {}

