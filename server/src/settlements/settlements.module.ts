import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';

@Module({
  providers: [SettlementsService]
})
export class SettlementsModule {}
