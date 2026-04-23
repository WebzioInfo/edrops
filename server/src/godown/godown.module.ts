import { Module } from '@nestjs/common';
import { GodownController } from './godown.controller';
import { GodownService } from './godown.service';

@Module({ controllers: [GodownController], providers: [GodownService], exports: [GodownService] })
export class GodownModule {}
