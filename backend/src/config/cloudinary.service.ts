import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

export interface UploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn('Cloudinary credentials are not fully configured in environment variables.');
    } else {
      this.logger.log(`Cloudinary configured successfully for cloud: ${cloudName}`);
    }
  }

  /**
   * Upload an image buffer directly to Cloudinary with automatic optimization.
   *
   * @param file MulterFile containing buffer, mimetype, and originalname
   * @param folder Destination Cloudinary folder (e.g. 'edrops/products')
   */
  async uploadImage(file: MulterFile, folder = 'edrops/products'): Promise<UploadResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No image file provided for upload.');
    }

    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Invalid image format (${file.mimetype}). Only JPEG, PNG, and WEBP images are supported.`,
      );
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('Image size exceeds the maximum allowed limit of 5 MB.');
    }

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [
              {
                quality: 'auto',
                fetch_format: 'auto',
              },
            ],
          },
          (error, response) => {
            if (error) {
              this.logger.error(`Cloudinary upload failed: ${error.message}`, error.stack);
              return reject(error);
            }
            if (!response) {
              return reject(new Error('Empty response received from Cloudinary.'));
            }
            resolve(response);
          },
        );

        const readable = new Readable();
        readable._read = () => {};
        readable.push(file.buffer);
        readable.push(null);
        readable.pipe(uploadStream);
      });

      this.logger.log(`Uploaded image to Cloudinary: ${result.secure_url} (public_id: ${result.public_id})`);

      return {
        url: result.url,
        secure_url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (err: any) {
      this.logger.error(`Failed to upload image to Cloudinary: ${err.message}`);
      throw new InternalServerErrorException(
        'Failed to upload image to cloud storage. Please try again.',
      );
    }
  }

  /**
   * Safely deletes an image from Cloudinary if hosted on Cloudinary.
   *
   * @param publicIdOrUrl Cloudinary public ID or secure URL
   */
  async deleteImage(publicIdOrUrl: string): Promise<boolean> {
    if (!publicIdOrUrl) return false;

    const publicId = this.extractPublicId(publicIdOrUrl);
    if (!publicId) return false;

    try {
      const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
      this.logger.log(`Cloudinary asset deleted (${publicId}): ${result.result}`);
      return result.result === 'ok';
    } catch (err: any) {
      this.logger.warn(`Failed to delete Cloudinary asset (${publicId}): ${err.message}`);
      return false;
    }
  }

  /**
   * Helper to extract public ID from a Cloudinary URL or return the public ID directly.
   */
  extractPublicId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    if (!urlOrId.startsWith('http://') && !urlOrId.startsWith('https://')) {
      return urlOrId;
    }

    try {
      const parsed = new URL(urlOrId);
      if (!parsed.hostname.includes('cloudinary.com')) return null;

      // URL format: https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<folder>/<public_id>.<ext>
      const uploadIndex = parsed.pathname.indexOf('/upload/');
      if (uploadIndex === -1) return null;

      let subPath = parsed.pathname.substring(uploadIndex + 8); // after '/upload/'
      // Strip optional version prefix v12345678/
      subPath = subPath.replace(/^v\d+\//, '');

      // Strip file extension
      const dotIndex = subPath.lastIndexOf('.');
      if (dotIndex !== -1) {
        subPath = subPath.substring(0, dotIndex);
      }

      return subPath || null;
    } catch {
      return null;
    }
  }
}
