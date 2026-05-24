import { uploadService, validateMagicBytes, getDateFolder, getFileCategory, getFileTypeFromExtension, MAX_MEDIA_PER_STEP } from './uploadService';
import { FILE_CONSTRAINTS } from '../types/constants';

describe('uploadService', () => {
  describe('validateFile', () => {
    const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
      ...overrides,
    });

    describe('image validation', () => {
      it('should accept valid JPEG file', () => {
        const file = createMockFile({
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        });

        const result = uploadService.validateFile(file, 'image');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept valid PNG file', () => {
        const file = createMockFile({
          mimetype: 'image/png',
          size: 2048,
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        });

        const result = uploadService.validateFile(file, 'image');
        expect(result.valid).toBe(true);
      });

      it('should reject unsupported MIME type for images', () => {
        const file = createMockFile({
          mimetype: 'image/gif',
          size: 1024,
          buffer: Buffer.from([0x47, 0x49, 0x46, 0x38]),
        });

        const result = uploadService.validateFile(file, 'image');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported file type');
      });

      it('should reject image exceeding 10MB', () => {
        const file = createMockFile({
          mimetype: 'image/jpeg',
          size: 11 * 1024 * 1024, // 11MB
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        });

        const result = uploadService.validateFile(file, 'image');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('maximum allowed size of 10 MB');
      });

      it('should accept image at exactly 10MB', () => {
        const file = createMockFile({
          mimetype: 'image/jpeg',
          size: 10 * 1024 * 1024, // exactly 10MB
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        });

        const result = uploadService.validateFile(file, 'image');
        expect(result.valid).toBe(true);
      });

      it('should reject image with mismatched magic bytes', () => {
        const file = createMockFile({
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG magic bytes but declared as JPEG
        });

        const result = uploadService.validateFile(file, 'image');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('File type mismatch');
      });
    });

    describe('PDF validation', () => {
      it('should accept valid PDF file', () => {
        const file = createMockFile({
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 5 * 1024 * 1024,
          buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]),
        });

        const result = uploadService.validateFile(file, 'pdf');
        expect(result.valid).toBe(true);
      });

      it('should reject PDF exceeding 25MB', () => {
        const file = createMockFile({
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: 26 * 1024 * 1024, // 26MB
          buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]),
        });

        const result = uploadService.validateFile(file, 'pdf');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('maximum allowed size of 25 MB');
      });

      it('should accept PDF at exactly 25MB', () => {
        const file = createMockFile({
          originalname: 'max.pdf',
          mimetype: 'application/pdf',
          size: 25 * 1024 * 1024,
          buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]),
        });

        const result = uploadService.validateFile(file, 'pdf');
        expect(result.valid).toBe(true);
      });

      it('should reject non-PDF MIME type for PDF category', () => {
        const file = createMockFile({
          originalname: 'fake.pdf',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
        });

        const result = uploadService.validateFile(file, 'pdf');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported file type');
      });

      it('should reject PDF with mismatched magic bytes', () => {
        const file = createMockFile({
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // JPEG magic bytes
        });

        const result = uploadService.validateFile(file, 'pdf');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('File type mismatch');
      });
    });
  });

  describe('validateMagicBytes', () => {
    it('should validate JPEG magic bytes', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(validateMagicBytes(buffer, 'image/jpeg')).toBe(true);
    });

    it('should validate PNG magic bytes', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateMagicBytes(buffer, 'image/png')).toBe(true);
    });

    it('should validate PDF magic bytes', () => {
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      expect(validateMagicBytes(buffer, 'application/pdf')).toBe(true);
    });

    it('should reject buffer too short for signature', () => {
      const buffer = Buffer.from([0xff, 0xd8]);
      expect(validateMagicBytes(buffer, 'image/jpeg')).toBe(false);
    });

    it('should reject unknown MIME type', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff]);
      expect(validateMagicBytes(buffer, 'image/gif')).toBe(false);
    });

    it('should reject mismatched bytes', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(validateMagicBytes(buffer, 'image/jpeg')).toBe(false);
      expect(validateMagicBytes(buffer, 'image/png')).toBe(false);
      expect(validateMagicBytes(buffer, 'application/pdf')).toBe(false);
    });
  });

  describe('getDateFolder', () => {
    it('should return a date-based path in YYYY/MM/DD format', () => {
      const folder = getDateFolder();
      expect(folder).toMatch(/^\d{4}[/\\]\d{2}[/\\]\d{2}$/);
    });

    it('should use current date', () => {
      const now = new Date();
      const folder = getDateFolder();
      const year = now.getFullYear().toString();
      expect(folder).toContain(year);
    });
  });

  describe('getFileCategory', () => {
    it('should return "image" for image/jpeg', () => {
      expect(getFileCategory('image/jpeg')).toBe('image');
    });

    it('should return "image" for image/png', () => {
      expect(getFileCategory('image/png')).toBe('image');
    });

    it('should return "pdf" for application/pdf', () => {
      expect(getFileCategory('application/pdf')).toBe('pdf');
    });

    it('should return null for unsupported types', () => {
      expect(getFileCategory('image/gif')).toBeNull();
      expect(getFileCategory('text/plain')).toBeNull();
    });
  });

  describe('getFileTypeFromExtension', () => {
    it('should return "image" for .jpg', () => {
      expect(getFileTypeFromExtension('.jpg')).toBe('image');
    });

    it('should return "image" for .jpeg', () => {
      expect(getFileTypeFromExtension('.jpeg')).toBe('image');
    });

    it('should return "image" for .png', () => {
      expect(getFileTypeFromExtension('.png')).toBe('image');
    });

    it('should return "pdf" for .pdf', () => {
      expect(getFileTypeFromExtension('.pdf')).toBe('pdf');
    });

    it('should return null for unsupported extensions', () => {
      expect(getFileTypeFromExtension('.gif')).toBeNull();
      expect(getFileTypeFromExtension('.txt')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(getFileTypeFromExtension('.JPG')).toBe('image');
      expect(getFileTypeFromExtension('.PDF')).toBe('pdf');
    });
  });

  describe('MAX_MEDIA_PER_STEP', () => {
    it('should be 20', () => {
      expect(MAX_MEDIA_PER_STEP).toBe(20);
    });
  });
});
