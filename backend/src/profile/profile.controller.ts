import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { UpdateProfileDto, ProfileAddressDto, UpdateProfileAddressDto } from './dto/profile.dto';
import { MulterFile } from '../config/cloudinary.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/octet-stream', // Some iOS browsers send octet-stream for heic
];

const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_BYTES,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase();

    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext || '');
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(mime);

    if (isAllowedMime || isAllowedExt) {
      return cb(null, true);
    }
    return cb(
      new BadRequestException(
        `Invalid file type (${file.mimetype}). Please upload a JPG, PNG, WEBP, or HEIC/HEIF image.`,
      ),
      false,
    );
  },
};

@Controller('profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.getProfile(userId);
  }

  @Patch()
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.updateProfile(userId, dto);
  }

  // ────────────────────────────────────────────────────────────────
  //  ADDRESS CRUD
  // ────────────────────────────────────────────────────────────────

  @Get('addresses')
  getAddresses(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.getAddresses(userId);
  }

  @Post('addresses')
  createAddress(@Req() req: any, @Body() dto: ProfileAddressDto) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.createAddress(userId, dto);
  }

  @Patch('addresses/:id')
  updateAddress(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProfileAddressDto) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.updateAddress(userId, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.deleteAddress(userId, id);
  }

  @Patch('addresses/:id/primary')
  setDefaultAddress(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.setDefaultAddress(userId, id);
  }

  // ────────────────────────────────────────────────────────────────
  //  AVATAR / PROFILE PICTURE MANAGEMENT
  // ────────────────────────────────────────────────────────────────

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadAvatar(@Req() req: any, @UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Please select an image.');
    }
    const userId = req.user.id || req.user.sub;
    return this.profileService.uploadAvatar(userId, file);
  }

  @Get('avatar/status/:jobId')
  getAvatarStatus(@Req() req: any, @Param('jobId') jobId: string) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.getAvatarJobStatus(userId, jobId);
  }

  @Delete('avatar')
  removeAvatar(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.profileService.removeAvatar(userId);
  }
}
