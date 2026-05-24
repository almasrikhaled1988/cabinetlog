import { CabinetGuide, ICabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { CreateGuideDTO, UpdateGuideDTO } from '../types/dto';
import { GuideFilters } from '../types/filters';
import { PaginatedResult } from '../types/common';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * Generate a URL-friendly slug from a title.
 * Contains only lowercase letters, digits, and hyphens.
 * Max 200 characters.
 */
function generateBaseSlug(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces and hyphens
    .replace(/[\s]+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens

  // Truncate to 200 characters
  if (slug.length > 200) {
    slug = slug.substring(0, 200);
    // Don't end with a hyphen after truncation
    slug = slug.replace(/-$/, '');
  }

  return slug || 'guide';
}

/**
 * Generate a unique slug by appending -2, -3, etc. if the base slug already exists.
 */
async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateBaseSlug(title);

  // Check if base slug is available
  const existing = await CabinetGuide.findOne({ slug: baseSlug });
  if (!existing) {
    return baseSlug;
  }

  // Find next available suffix
  let suffix = 2;
  while (true) {
    const suffixStr = `-${suffix}`;
    // Ensure total slug length doesn't exceed 200
    const maxBaseLength = 200 - suffixStr.length;
    const truncatedBase = baseSlug.substring(0, maxBaseLength).replace(/-$/, '');
    const candidateSlug = `${truncatedBase}${suffixStr}`;

    const existsWithSuffix = await CabinetGuide.findOne({ slug: candidateSlug });
    if (!existsWithSuffix) {
      return candidateSlug;
    }
    suffix++;
  }
}

/**
 * Validate guide fields for creation or update.
 * Returns a record of field errors, or empty object if valid.
 */
function validateGuideFields(
  data: Partial<CreateGuideDTO>,
  isCreate: boolean
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Title validation
  if (isCreate && (data.title === undefined || data.title === null)) {
    errors.title = 'Title is required';
  } else if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length < 3) {
      errors.title = 'Title must be between 3 and 200 characters';
    } else if (data.title.trim().length > 200) {
      errors.title = 'Title must be between 3 and 200 characters';
    }
  }

  // Description validation
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.description = 'Description must not exceed 5000 characters';
    } else if (data.description.length > 5000) {
      errors.description = 'Description must not exceed 5000 characters';
    }
  }

  // Cabinet type validation
  if (isCreate && (data.cabinet_type === undefined || data.cabinet_type === null)) {
    errors.cabinet_type = 'Cabinet type is required';
  } else if (data.cabinet_type !== undefined) {
    if (typeof data.cabinet_type !== 'string' || data.cabinet_type.trim().length < 1) {
      errors.cabinet_type = 'Cabinet type must be between 1 and 100 characters';
    } else if (data.cabinet_type.trim().length > 100) {
      errors.cabinet_type = 'Cabinet type must be between 1 and 100 characters';
    }
  }

  return errors;
}

export const guideService = {
  /**
   * Create a new guide with status 'draft' and version 1.
   * Generates a unique slug from the title.
   */
  async createGuide(data: CreateGuideDTO, userId: string): Promise<ICabinetGuide> {
    // Validate input
    const errors = validateGuideFields(data, true);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(data.title);

    const now = new Date();
    const guide = await CabinetGuide.create({
      title: data.title.trim(),
      slug,
      cabinet_type: data.cabinet_type.trim(),
      drive_model: data.drive_model || '',
      description: data.description || '',
      thumbnail_image: data.thumbnail_image,
      status: 'draft',
      version: 1,
      tags: data.tags || [],
      created_by: userId,
      created_at: now,
      updated_at: now,
    });

    return guide;
  },

  /**
   * Get paginated list of guides with optional filters.
   * Default page size is 20, sorted by updated_at descending.
   */
  async getGuides(filters: GuideFilters): Promise<PaginatedResult<ICabinetGuide>> {
    const page = filters.page !== undefined && filters.page !== null ? filters.page : 1;
    const limit = filters.limit !== undefined && filters.limit !== null ? filters.limit : 20;

    // Validate pagination params
    if (page < 1 || !Number.isInteger(page)) {
      throw new ValidationError('Validation failed', {
        page: 'Page must be a positive integer',
      });
    }
    if (limit < 1 || limit > 100 || !Number.isInteger(limit)) {
      throw new ValidationError('Validation failed', {
        limit: 'Limit must be between 1 and 100',
      });
    }

    // Build query
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.cabinetType) {
      query.cabinet_type = filters.cabinetType;
    }

    if (filters.driveModel) {
      query.drive_model = new RegExp(filters.driveModel, 'i');
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      CabinetGuide.find(query)
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tags', 'name')
        .populate('created_by', 'name email')
        .lean(),
      CabinetGuide.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as unknown as ICabinetGuide[],
      total,
      page,
      totalPages,
    };
  },

  /**
   * Get a single guide by ID. Returns null if not found.
   */
  async getGuideById(id: string): Promise<ICabinetGuide> {
    const guide = await CabinetGuide.findById(id)
      .populate('tags', 'name')
      .populate('created_by', 'name email');

    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    return guide;
  },

  /**
   * Update a guide. Updates the updated_at timestamp.
   * Validates fields and returns 404 if guide doesn't exist.
   */
  async updateGuide(id: string, data: UpdateGuideDTO): Promise<ICabinetGuide> {
    // Validate input
    const errors = validateGuideFields(data, false);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    const guide = await CabinetGuide.findById(id);
    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    // Apply updates
    if (data.title !== undefined) {
      guide.title = data.title.trim();
      // Regenerate slug when title changes
      guide.slug = await generateUniqueSlug(data.title);
    }
    if (data.cabinet_type !== undefined) {
      guide.cabinet_type = data.cabinet_type.trim();
    }
    if (data.drive_model !== undefined) {
      guide.drive_model = data.drive_model;
    }
    if (data.description !== undefined) {
      guide.description = data.description;
    }
    if (data.thumbnail_image !== undefined) {
      guide.thumbnail_image = data.thumbnail_image;
    }
    if (data.tags !== undefined) {
      guide.tags = data.tags as any;
    }

    guide.updated_at = new Date();
    await guide.save();

    return guide;
  },

  /**
   * Delete a guide and cascade delete all associated build steps,
   * step media records, and files from the filesystem.
   */
  async deleteGuide(id: string): Promise<void> {
    const guide = await CabinetGuide.findById(id);
    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    // Find all build steps for this guide
    const steps = await BuildStep.find({ cabinet_guide_id: id });
    const stepIds = steps.map((s) => s._id);

    // Find all media for these steps
    const mediaRecords = await StepMedia.find({ build_step_id: { $in: stepIds } });

    // Delete files from filesystem (log failures but continue)
    for (const media of mediaRecords) {
      try {
        const filePath = path.join(UPLOAD_ROOT, media.file_path);
        await fs.unlink(filePath);
      } catch (err) {
        // Log failure but continue deletion
        console.error(`Failed to delete file ${media.file_path}:`, err);
      }
    }

    // Delete media records
    await StepMedia.deleteMany({ build_step_id: { $in: stepIds } });

    // Delete build steps
    await BuildStep.deleteMany({ cabinet_guide_id: id });

    // Delete the guide
    await CabinetGuide.findByIdAndDelete(id);
  },
};

/**
 * Valid status transitions for cabinet guides.
 * draft → published, draft → archived, published → archived, archived → draft
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: ['draft'],
};

/**
 * Transitions a guide's status to the target status, enforcing business rules.
 *
 * - Only valid transitions are allowed (see VALID_TRANSITIONS)
 * - Publishing requires at least 1 build step
 * - Publishing increments version by 1
 * - Version never decreases across any transition sequence
 * - updated_at is refreshed on every status change
 *
 * @param guideId - The ID of the guide to transition
 * @param targetStatus - The desired new status
 * @returns The updated guide document
 * @throws NotFoundError if guide does not exist
 * @throws ValidationError if transition is invalid or publish preconditions fail
 */
export async function transitionGuideStatus(
  guideId: string,
  targetStatus: string
): Promise<ICabinetGuide> {
  // Step 1: Fetch current guide
  const guide = await CabinetGuide.findById(guideId);
  if (!guide) {
    throw new NotFoundError('Guide not found');
  }

  // Step 2: Validate transition
  const allowedTargets = VALID_TRANSITIONS[guide.status];
  if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
    throw new ValidationError(
      `Cannot transition from '${guide.status}' to '${targetStatus}'`
    );
  }

  // Step 3: Apply business rules for publishing
  if (targetStatus === 'published') {
    const stepCount = await BuildStep.countDocuments({
      cabinet_guide_id: guideId,
    });
    if (stepCount === 0) {
      throw new ValidationError('Cannot publish guide with no build steps');
    }
    guide.version += 1;
  }

  // Step 4: Update status and timestamp
  guide.status = targetStatus as ICabinetGuide['status'];
  guide.updated_at = new Date();
  await guide.save();

  return guide;
}

// Export helper functions for testing
export { generateBaseSlug, generateUniqueSlug, validateGuideFields, VALID_TRANSITIONS };
