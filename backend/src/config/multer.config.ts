import { memoryStorage, Options } from 'multer';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const multerOptions: Options = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      return callback(
        new BadRequestException(
          `Invalid file type (${file.mimetype}). Only JPEG, JPG, PNG, and WEBP images are allowed.`,
        ),
        false,
      );
    }
    callback(null, true);
  },
};
