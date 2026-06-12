import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { StepMedia, IStepMedia } from '../models/StepMedia';
import { FILE_CONSTRAINTS, FileCategory } from '../types/constants';
import { ValidationResult } from '../types/common';
import { ValidationError } from '../middleware/errorHandler';

/** Maximum number of media files allowed per build step */
const MAX_MEDIA_PER_STEP = 20;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Magic byte signatures for allowed file types.
 */
const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'application/pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
};

/**
 * Generate a date-based folder path (YYYY/MM/DD).
 */
function getDateFolder(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Determine the file category from a MIME type.
 */
function getFileCategory(mimetype: string): FileCategory | null {
  if ((FILE_CONSTRAINTS.image.allowedTypes as readonly string[]).includes(mimetype)) {
    return 'image';
  }
  if ((FILE_CONSTRAINTS.pdf.allowedTypes as readonly string[]).includes(mimetype)) {
    return 'pdf';
  }
  return null;
}

/**
 * Determine the file_type field value from a file extension.
 */
function getFileTypeFromExtension(ext: string): 'image' | 'pdf' | null {
  const lowerExt = ext.toLowerCase();
  if ((FILE_CONSTRAINTS.image.extensions as readonly string[]).includes(lowerExt)) {
    return 'image';
  }
  if ((FILE_CONSTRAINTS.pdf.extensions as readonly string[]).includes(lowerExt)) {
    return 'pdf';
  }
  return null;
}

/**
 * Validate magic bytes of a file buffer against the declared MIME type.
 */
function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) {
    return false;
  }

  return signatures.some((sig) => {
    if (buffer.length < sig.offset + sig.bytes.length) {
      return false;
    }
    return sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte);
  });
}

/**
 * Upload a buffer to Cloudinary and return the result.
 */
function uploadToCloudinary(
  buffer: Buffer,
  options: { folder: string; public_id: string; resource_type: 'image' | 'raw' }
): Promise<{ secure_url: string; bytes: number; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.public_id,
        resource_type: options.resource_type,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve({
          secure_url: result.secure_url,
          bytes: result.bytes,
          public_id: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}

export const uploadService = {
  /**
   * Validate an uploaded file against type-specific constraints.
   */
  validateFile(file: Express.Multer.File, type: FileCategory): ValidationResult {
    const constraints = FILE_CONSTRAINTS[type];

    if (!(constraints.allowedTypes as readonly string[]).includes(file.mimetype)) {
      const allowed = constraints.allowedTypes.join(', ');
      return {
        valid: false,
        error: `Unsupported file type. Allowed types: ${allowed}`,
      };
    }

    if (file.size > constraints.maxSize) {
      const maxMB = constraints.maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `File exceeds the maximum allowed size of ${maxMB} MB`,
      };
    }

    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      return {
        valid: false,
        error: 'File type mismatch: file content does not match the declared type',
      };
    }

    return { valid: true };
  },

  /**
   * Upload and process an image file.
   * Compresses with sharp, uploads to Cloudinary, creates StepMedia record.
   */
  async uploadImage(file: Express.Multer.File, buildStepId: string): Promise<IStepMedia> {
    const validation = this.validateFile(file, 'image');
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    const mediaCount = await StepMedia.countDocuments({ build_step_id: buildStepId });
    if (mediaCount >= MAX_MEDIA_PER_STEP) {
      throw new ValidationError(
        `Maximum of ${MAX_MEDIA_PER_STEP} media files per build step exceeded`
      );
    }

    // Compress image with sharp
    const compressedBuffer = await sharp(file.buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload to Cloudinary
    const filename = uuidv4();
    const folder = `werkflow/images/${getDateFolder()}`;

    const result = await uploadToCloudinary(compressedBuffer, {
      folder,
      public_id: filename,
      resource_type: 'image',
    });

    // Determine sort_order
    const maxMedia = await StepMedia.findOne({ build_step_id: buildStepId })
      .sort({ sort_order: -1 })
      .select('sort_order');
    const sortOrder = maxMedia ? maxMedia.sort_order + 1 : 0;

    // Create media record (file_path stores the Cloudinary URL)
    const media = await StepMedia.create({
      build_step_id: buildStepId,
      file_type: 'image',
      file_path: result.secure_url,
      original_name: file.originalname,
      file_size: result.bytes,
      sort_order: sortOrder,
      created_at: new Date(),
    });

    return media;
  },

  /**
   * Upload a PDF file to Cloudinary.
   */
  async uploadPDF(file: Express.Multer.File, buildStepId: string): Promise<IStepMedia> {
    const validation = this.validateFile(file, 'pdf');
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    const mediaCount = await StepMedia.countDocuments({ build_step_id: buildStepId });
    if (mediaCount >= MAX_MEDIA_PER_STEP) {
      throw new ValidationError(
        `Maximum of ${MAX_MEDIA_PER_STEP} media files per build step exceeded`
      );
    }

    // Upload to Cloudinary as raw file
    const filename = uuidv4();
    const folder = `werkflow/pdfs/${getDateFolder()}`;

    const result = await uploadToCloudinary(file.buffer, {
      folder,
      public_id: filename,
      resource_type: 'raw',
    });

    // Determine sort_order
    const maxMedia = await StepMedia.findOne({ build_step_id: buildStepId })
      .sort({ sort_order: -1 })
      .select('sort_order');
    const sortOrder = maxMedia ? maxMedia.sort_order + 1 : 0;

    // Create media record
    const media = await StepMedia.create({
      build_step_id: buildStepId,
      file_type: 'pdf',
      file_path: result.secure_url,
      original_name: file.originalname,
      file_size: file.size,
      sort_order: sortOrder,
      created_at: new Date(),
    });

    return media;
  },

  /**
   * Delete a file from Cloudinary.
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/cloud/image/upload/v123/folder/filename.ext
      const urlParts = filePath.split('/upload/');
      if (urlParts.length === 2) {
        // Remove version prefix (v123456/) and file extension
        const pathAfterUpload = urlParts[1].replace(/^v\d+\//, '');
        const publicId = pathAfterUpload.replace(/\.[^.]+$/, '');

        // Try deleting as image first, then as raw (for PDFs)
        const imageResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        if (imageResult.result !== 'ok') {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        }
      }
    } catch (err) {
      console.error(`Failed to delete file from Cloudinary: ${filePath}`, err);
    }
  },
};

// Export helpers for testing
export {
  getDateFolder,
  getFileCategory,
  getFileTypeFromExtension,
  validateMagicBytes,
  MAGIC_BYTES,
  MAX_MEDIA_PER_STEP,
};
