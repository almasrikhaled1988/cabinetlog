import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { GuideMaterial } from '../models/GuideMaterial';
import { GuideVersion } from '../models/GuideVersion';
import { Types } from 'mongoose';
import { NotFoundError } from '../middleware/errorHandler';

/**
 * Generate a unique slug from a title.
 */
function generateBaseSlug(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length > 200) {
    slug = slug.substring(0, 200).replace(/-$/, '');
  }

  return slug || 'guide';
}

async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateBaseSlug(title);

  const existing = await CabinetGuide.findOne({ slug: baseSlug });
  if (!existing) return baseSlug;

  let suffix = 2;
  while (true) {
    const suffixStr = `-${suffix}`;
    const maxBaseLength = 200 - suffixStr.length;
    const truncatedBase = baseSlug.substring(0, maxBaseLength).replace(/-$/, '');
    const candidateSlug = `${truncatedBase}${suffixStr}`;

    const exists = await CabinetGuide.findOne({ slug: candidateSlug });
    if (!exists) return candidateSlug;
    suffix++;
  }
}

export const guideTemplateService = {
  /**
   * Duplicate a guide (with all steps and materials).
   * Creates a new draft guide as a copy.
   */
  async duplicateGuide(sourceGuideId: string, userId: string, newTitle?: string) {
    const sourceGuide = await CabinetGuide.findById(sourceGuideId);
    if (!sourceGuide) {
      throw new NotFoundError('Source guide not found');
    }

    const title = newTitle || `${sourceGuide.title} (Copy)`;
    const slug = await generateUniqueSlug(title);
    const now = new Date();

    // Create new guide
    const newGuide = await CabinetGuide.create({
      title,
      slug,
      cabinet_type: sourceGuide.cabinet_type,
      drive_model: sourceGuide.drive_model,
      description: sourceGuide.description,
      thumbnail_image: sourceGuide.thumbnail_image,
      status: 'draft',
      version: 1,
      is_template: false,
      tags: sourceGuide.tags,
      created_by: new Types.ObjectId(userId),
      created_at: now,
      updated_at: now,
    });

    // Copy steps
    const sourceSteps = await BuildStep.find({ cabinet_guide_id: sourceGuideId }).sort({
      step_order: 1,
    });

    for (const step of sourceSteps) {
      await BuildStep.create({
        cabinet_guide_id: newGuide._id,
        title: step.title,
        description: step.description,
        step_order: step.step_order,
        estimated_time: step.estimated_time,
        warning_notes: step.warning_notes,
        checklist_items: step.checklist_items,
      });
    }

    // Copy materials
    const sourceMaterials = await GuideMaterial.find({ guide_id: sourceGuideId }).sort({
      sort_order: 1,
    });

    for (const mat of sourceMaterials) {
      await GuideMaterial.create({
        guide_id: newGuide._id,
        name: mat.name,
        quantity: mat.quantity,
        unit: mat.unit,
        category: mat.category,
        part_number: mat.part_number,
        sort_order: mat.sort_order,
      });
    }

    return newGuide;
  },

  /**
   * Get all template guides.
   */
  async getTemplates() {
    return CabinetGuide.find({ is_template: true })
      .select('title cabinet_type drive_model description')
      .sort({ title: 1 })
      .lean();
  },

  /**
   * Mark/unmark a guide as a template.
   */
  async toggleTemplate(guideId: string, isTemplate: boolean) {
    const guide = await CabinetGuide.findById(guideId);
    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    guide.is_template = isTemplate;
    guide.updated_at = new Date();
    await guide.save();
    return guide;
  },

  /**
   * Create a version snapshot when publishing.
   */
  async createVersionSnapshot(guideId: string, userId: string, changelog?: string) {
    const guide = await CabinetGuide.findById(guideId).populate('tags', 'name');
    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    const steps = await BuildStep.find({ cabinet_guide_id: guideId })
      .sort({ step_order: 1 })
      .lean();

    const snapshot = {
      title: guide.title,
      cabinet_type: guide.cabinet_type,
      drive_model: guide.drive_model,
      description: guide.description,
      tags: (guide.tags as any[]).map((t: any) => t.name || t),
      steps: steps.map((s) => ({
        title: s.title,
        description: s.description,
        step_order: s.step_order,
        estimated_time: s.estimated_time,
        warning_notes: s.warning_notes,
        checklist_items: s.checklist_items,
      })),
    };

    const version = await GuideVersion.create({
      guide_id: new Types.ObjectId(guideId),
      version: guide.version,
      snapshot,
      changelog: changelog?.trim() || undefined,
      published_by: new Types.ObjectId(userId),
    });

    return version;
  },

  /**
   * Get version history for a guide.
   */
  async getVersionHistory(guideId: string) {
    return GuideVersion.find({ guide_id: new Types.ObjectId(guideId) })
      .sort({ version: -1 })
      .populate('published_by', 'name')
      .lean();
  },

  /**
   * Get a specific version snapshot.
   */
  async getVersion(guideId: string, version: number) {
    const doc = await GuideVersion.findOne({
      guide_id: new Types.ObjectId(guideId),
      version,
    })
      .populate('published_by', 'name')
      .lean();

    if (!doc) {
      throw new NotFoundError('Version not found');
    }

    return doc;
  },
};
