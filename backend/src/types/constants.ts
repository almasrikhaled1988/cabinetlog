export const FILE_CONSTRAINTS = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png'] as const,
    extensions: ['.jpg', '.jpeg', '.png'] as const,
  },
  pdf: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedTypes: ['application/pdf'] as const,
    extensions: ['.pdf'] as const,
  },
} as const;

export type FileCategory = keyof typeof FILE_CONSTRAINTS;
