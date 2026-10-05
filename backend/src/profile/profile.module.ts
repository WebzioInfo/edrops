import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AvatarProcessingQueueService } from './avatar-processing-queue.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryService } from '../config/cloudinary.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileController],
  providers: [ProfileService, AvatarProcessingQueueService, CloudinaryService],
  exports: [ProfileService, AvatarProcessingQueueService],
})
export class ProfileModule {}
