import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService, MulterFile } from '../config/cloudinary.service';
import * as crypto from 'crypto';
const sharp = require('sharp');

// Dual fallback for HEIC/HEIF
let heicConvert: any = null;
try {
  heicConvert = require('heic-convert');
} catch (e) {
  // heicConvert not available
}

export type AvatarJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AvatarJob {
  id: string;
  userId: string;
  originalName: string;
  status: AvatarJobStatus;
  avatarUrl?: string | null;
  errorMessage?: string;
  version: number;
  createdAt: Date;
  completedAt?: Date;
}

const MAX_IMAGE_DIMENSION = 1024;
const JPEG_QUALITY = 85;

@Injectable()
export class AvatarProcessingQueueService {
  private readonly logger = new Logger(AvatarProcessingQueueService.name);

  // In-memory queue / state cache for asynchronous jobs
  private jobs = new Map<string, AvatarJob>();

  // Track latest upload version per user to prevent concurrent race conditions
  private userUploadVersion = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Detect whether a buffer is HEIC or HEIF based on ISO Base Media File Format magic bytes.
   */
  isHeicBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) return false;
    // Check ftyp box at byte 4: 'ftyp'
    const ftyp = buffer.toString('ascii', 4, 8);
    if (ftyp !== 'ftyp') return false;

    // Brand identifiers for HEIC/HEIF
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'hevm', 'hevs'];
    return heicBrands.includes(brand);
  }

  /**
   * Determine format from mime type, file extension, and buffer magic bytes.
   */
  detectFormat(file: MulterFile): 'heic' | 'jpeg' | 'png' | 'webp' | 'unknown' {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase();

    if (
      mime.includes('heic') ||
      mime.includes('heif') ||
      ext === 'heic' ||
      ext === 'heif' ||
      this.isHeicBuffer(file.buffer)
    ) {
      return 'heic';
    }

    if (mime.includes('jpeg') || mime.includes('jpg') || ext === 'jpg' || ext === 'jpeg') {
      return 'jpeg';
    }

    if (mime.includes('png') || ext === 'png') {
      return 'png';
    }

    if (mime.includes('webp') || ext === 'webp') {
      return 'webp';
    }

    return 'unknown';
  }

  /**
   * Convert and optimize any input image (HEIC, HEIF, PNG, WEBP, JPEG) into standard, clean JPEG.
   */
  async processToJpeg(buffer: Buffer, format: 'heic' | 'jpeg' | 'png' | 'webp' | 'unknown'): Promise<Buffer> {
    let intermediateBuffer = buffer;

    // 1. If HEIC/HEIF, convert to raw image or JPEG first
    if (format === 'heic') {
      this.logger.log('Detected HEIC/HEIF image. Beginning conversion pipeline...');
      let converted = false;

      // Try sharp native libheif first
      try {
        const sharpMeta = await sharp(buffer).metadata();
        if (sharpMeta.format === 'heif' || (sharpMeta.format as any) === 'heic') {
          intermediateBuffer = await sharp(buffer)
            .rotate() // Auto-orient from EXIF
            .toFormat('jpeg')
            .toBuffer();
          converted = true;
          this.logger.log('Successfully decoded HEIC using Sharp native libheif.');
        }
      } catch (err: any) {
        this.logger.warn(`Sharp native HEIC decode failed: ${err.message}. Attempting heic-convert fallback.`);
      }

      // If sharp failed or wasn't sure, use heic-convert as reliable fallback
      if (!converted && heicConvert) {
        try {
          const rawJpeg = await heicConvert({
            buffer,
            format: 'JPEG',
            quality: 0.9,
          });
          intermediateBuffer = Buffer.from(rawJpeg);
          converted = true;
          this.logger.log('Successfully converted HEIC using heic-convert fallback.');
        } catch (convertErr: any) {
          this.logger.error(`heic-convert also failed: ${convertErr.message}`);
          throw new Error(`Failed to decode HEIC image: ${convertErr.message}`);
        }
      }

      if (!converted) {
        throw new Error('Unsupported HEIC image payload could not be decoded.');
      }
    }

    // 2. Final optimization pipeline using Sharp:
    // - Resize to max 1024x1024 (preserving aspect ratio)
    // - Rotate based on EXIF orientation
    // - Strip GPS / camera metadata
    // - Output progressive, high-quality JPEG
    const finalJpeg = await sharp(intermediateBuffer)
      .rotate() // Auto-orient
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();

    return finalJpeg;
  }

  /**
   * Enqueue an avatar upload job and return immediately with job details.
   */
  enqueueAvatarUpload(userId: string, file: MulterFile): AvatarJob {
    if (!file || !file.buffer) {
      throw new BadRequestException('No image file uploaded');
    }

    const format = this.detectFormat(file);
    if (format === 'unknown') {
      throw new BadRequestException('Unsupported image format. Please upload JPG, PNG, WEBP, or HEIC/HEIF.');
    }

    // Increment user version to handle rapid concurrent uploads
    const currentVersion = (this.userUploadVersion.get(userId) || 0) + 1;
    this.userUploadVersion.set(userId, currentVersion);

    const jobId = `job_${crypto.randomUUID()}`;
    const job: AvatarJob = {
      id: jobId,
      userId,
      originalName: file.originalname,
      status: 'PROCESSING',
      version: currentVersion,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Run processing asynchronously on next tick without blocking API response
    setImmediate(() => {
      this.executeJob(job, file, format).catch((err) => {
        this.logger.error(`Unhandled error in background avatar job ${jobId}: ${err.message}`, err.stack);
      });
    });

    return job;
  }

  /**
   * Background worker execution
   */
  private async executeJob(job: AvatarJob, file: MulterFile, format: 'heic' | 'jpeg' | 'png' | 'webp' | 'unknown') {
    try {
      this.logger.log(`Worker processing avatar job ${job.id} for user ${job.userId} (format: ${format})...`);

      // 1. Process and convert image to optimized JPEG
      const finalJpegBuffer = await this.processToJpeg(file.buffer, format);

      // Check if a newer upload has superseded this job
      const activeVersion = this.userUploadVersion.get(job.userId);
      if (activeVersion && activeVersion > job.version) {
        this.logger.log(`Avatar job ${job.id} superseded by newer job (v${activeVersion} > v${job.version}). Aborting.`);
        job.status = 'FAILED';
        job.errorMessage = 'Superseded by a newer image upload.';
        job.completedAt = new Date();
        return;
      }

      // 2. Fetch existing avatar to clean up later
      const user = await this.prisma.user.findUnique({
        where: { id: job.userId },
        select: { id: true, avatarUrl: true },
      });

      if (!user) {
        job.status = 'FAILED';
        job.errorMessage = 'User no longer exists.';
        job.completedAt = new Date();
        return;
      }

      // 3. Upload final JPEG to Cloudinary
      const sanitizedName = (file.originalname || 'avatar')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      const convertedFile: MulterFile = {
        fieldname: 'file',
        originalname: `${sanitizedName}_converted.jpg`,
        encoding: file.encoding,
        mimetype: 'image/jpeg',
        size: finalJpegBuffer.length,
        buffer: finalJpegBuffer,
      };

      const uploadResult = await this.cloudinaryService.uploadImage(convertedFile, 'edrops/avatars');

      // Final concurrency check before saving to database
      if (this.userUploadVersion.get(job.userId) !== job.version) {
        this.logger.log(`Discarding upload result for job ${job.id} due to concurrent newer upload.`);
        // Clean up uploaded image if superseded
        this.cloudinaryService.deleteImage(uploadResult.secure_url).catch(() => {});
        job.status = 'FAILED';
        job.errorMessage = 'Superseded by a newer image upload.';
        job.completedAt = new Date();
        return;
      }

      // 4. Update User record in database
      await this.prisma.user.update({
        where: { id: job.userId },
        data: { avatarUrl: uploadResult.secure_url },
      });

      // 5. Clean up old avatar image from storage
      if (user.avatarUrl && user.avatarUrl !== uploadResult.secure_url) {
        this.cloudinaryService.deleteImage(user.avatarUrl).catch((err) => {
          this.logger.warn(`Failed to delete previous avatar (${user.avatarUrl}): ${err.message}`);
        });
      }

      job.status = 'COMPLETED';
      job.avatarUrl = uploadResult.secure_url;
      job.completedAt = new Date();

      this.logger.log(`Avatar job ${job.id} completed successfully for user ${job.userId}.`);
    } catch (err: any) {
      this.logger.error(`Avatar processing job ${job.id} failed: ${err.message}`, err.stack);
      job.status = 'FAILED';
      job.errorMessage = 'Unable to process this image. Please try another image.';
      job.completedAt = new Date();
    }
  }

  /**
   * Query status of an image processing job
   */
  getJobStatus(jobId: string, userId: string): AvatarJob {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Avatar processing job not found');
    }
    return job;
  }
}
