import { BuildStep, IBuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { CreateStepDTO, UpdateStepDTO } from '../types/dto';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * Validate step fields for creation or update.
 * Returns a record of field errors, or empty object if valid.
 */
function validateStepFields(
  data: Partial<CreateStepDTO>,
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

  // Warning notes validation
  if (data.warning_notes !== undefined && data.warning_notes !== null) {
    if (typeof data.warning_notes === 'string' && data.warning_notes.length > 1000) {
      errors.warning_notes = 'Warning notes must not exceed 1000 characters';
    }
  }

  // Estimated time validation
  if (data.estimated_time !== undefined && data.estimated_time !== null) {
    if (typeof data.estimated_time !== 'number' || data.estimated_time <= 0 || data.estimated_time > 10080) {
      errors.estimated_time =
        'Estimated time must be a positive number not exceeding 10080 minutes';
    }
  }

  // Step order validation (only for explicit step_order values)
  if (data.step_order !== undefined && data.step_order !== null) {
    if (
      typeof data.step_order !== 'number' ||
      !Number.isInteger(data.step_order) ||
      data.step_order < 1
    ) {
      errors.step_order = 'Step order must be a positive integer';
    }
  }

  return errors;
}

/**
 * Reassign step_order values to form a contiguous sequence 1..N
 * for all steps in the given guide.
 */
async function reassignStepOrders(guideId: string): Promise<void> {
  const steps = await BuildStep.find({ cabinet_guide_id: guideId }).sort({ step_order: 1 });

  if (steps.length === 0) return;

  // Two-phase approach to avoid unique index conflicts on (cabinet_guide_id, step_order)
  const tempOperations = steps.map((step, index) => ({
    updateOne: {
      filter: { _id: step._id },
      update: { $set: { step_order: -(index + 1) } },
    },
  }));

  const finalOperations = steps.map((step, index) => ({
    updateOne: {
      filter: { _id: step._id },
      update: { $set: { step_order: index + 1 } },
    },
  }));

  await BuildStep.bulkWrite(tempOperations);
  await BuildStep.bulkWrite(finalOperations);
}

export const stepService = {
  /**
   * Create a new build step for a guide.
   * Auto-assigns step_order as max existing + 1, or 1 if first step.
   */
  async createStep(guideId: string, data: CreateStepDTO): Promise<IBuildStep> {
    // Validate input
    const errors = validateStepFields(data, true);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    // Determine step_order: max existing + 1, or 1 if no steps
    const maxStep = await BuildStep.findOne({ cabinet_guide_id: guideId })
      .sort({ step_order: -1 })
      .select('step_order');

    const stepOrder = maxStep ? maxStep.step_order + 1 : 1;

    const step = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: data.title.trim(),
      description: data.description || '',
      step_order: stepOrder,
      estimated_time: data.estimated_time,
      warning_notes: data.warning_notes,
      created_at: new Date(),
    });

    return step;
  },

  /**
   * Update an existing build step.
   * Validates fields and returns 404 if step doesn't exist.
   */
  async updateStep(stepId: string, data: UpdateStepDTO): Promise<IBuildStep> {
    // Validate input
    const errors = validateStepFields(data, false);
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    const step = await BuildStep.findById(stepId);
    if (!step) {
      throw new NotFoundError('Build step not found');
    }

    // Apply updates
    if (data.title !== undefined) {
      step.title = data.title.trim();
    }
    if (data.description !== undefined) {
      step.description = data.description;
    }
    if (data.step_order !== undefined) {
      step.step_order = data.step_order;
    }
    if (data.estimated_time !== undefined) {
      step.estimated_time = data.estimated_time;
    }
    if (data.warning_notes !== undefined) {
      step.warning_notes = data.warning_notes;
    }

    await step.save();
    return step;
  },

  /**
   * Delete a build step and cascade delete associated media records and files.
   * Reassigns step_order values of remaining steps to contiguous 1..N.
   */
  async deleteStep(stepId: string): Promise<void> {
    const step = await BuildStep.findById(stepId);
    if (!step) {
      throw new NotFoundError('Build step not found');
    }

    const guideId = step.cabinet_guide_id.toString();

    // Find and delete associated media
    const mediaRecords = await StepMedia.find({ build_step_id: stepId });

    // Delete files from filesystem
    for (const media of mediaRecords) {
      try {
        const filePath = path.join(UPLOAD_ROOT, media.file_path);
        await fs.unlink(filePath);
      } catch (err) {
        console.error(`Failed to delete file ${media.file_path}:`, err);
      }
    }

    // Delete media records
    await StepMedia.deleteMany({ build_step_id: stepId });

    // Delete the step
    await BuildStep.findByIdAndDelete(stepId);

    // Reassign step_order for remaining steps to maintain contiguous 1..N
    await reassignStepOrders(guideId);
  },

  /**
   * Reorder all steps in a guide to match the provided ID sequence.
   *
   * Validates that:
   * - All provided IDs belong to the specified guide
   * - No duplicate IDs are present
   * - The provided IDs are an exact permutation of all steps in the guide
   *
   * Uses bulkWrite for atomic update of step_order values to contiguous 1..N.
   *
   * @param guideId - The guide whose steps are being reordered
   * @param stepIds - Array of step ID strings representing the new order
   * @returns The updated steps sorted by new step_order
   * @throws ValidationError if validation fails (step_order values remain unchanged)
   */
  async reorderSteps(guideId: string, stepIds: string[]): Promise<IBuildStep[]> {
    // Step 1: Fetch all existing steps for this guide
    const existingSteps = await BuildStep.find({ cabinet_guide_id: guideId }).exec();
    const existingIds = new Set(existingSteps.map((s) => (s._id as string).toString()));

    // Step 2: Check for duplicates in the provided stepIds
    const providedIdsSet = new Set(stepIds);
    if (providedIdsSet.size !== stepIds.length) {
      throw new ValidationError(
        'Step IDs contain duplicates'
      );
    }

    // Step 3: Validate all provided IDs belong to this guide
    for (const id of stepIds) {
      if (!existingIds.has(id)) {
        throw new ValidationError(
          `Step ${id} does not belong to guide ${guideId}`
        );
      }
    }

    // Step 4: Validate exact permutation (same count)
    if (stepIds.length !== existingSteps.length) {
      throw new ValidationError(
        'stepIds must include all steps in the guide'
      );
    }

    // Step 5: Build bulk update operations for atomic reorder.
    // Use a two-phase approach to avoid unique index conflicts on (cabinet_guide_id, step_order):
    // Phase 1: Set all step_orders to temporary negative values (no conflicts possible)
    // Phase 2: Set all step_orders to their final positive 1..N values
    const tempOperations = stepIds.map((stepId, index) => ({
      updateOne: {
        filter: { _id: stepId },
        update: { $set: { step_order: -(index + 1) } },
      },
    }));

    const finalOperations = stepIds.map((stepId, index) => ({
      updateOne: {
        filter: { _id: stepId },
        update: { $set: { step_order: index + 1 } },
      },
    }));

    // Step 6: Execute atomic bulk writes
    await BuildStep.bulkWrite(tempOperations);
    await BuildStep.bulkWrite(finalOperations);

    // Step 7: Return updated steps in new order
    const updatedSteps = await BuildStep.find({ cabinet_guide_id: guideId })
      .sort({ step_order: 1 })
      .lean();

    return updatedSteps as IBuildStep[];
  },

  /**
   * Get all steps for a guide, sorted by step_order ascending.
   */
  async getStepsByGuide(guideId: string): Promise<IBuildStep[]> {
    const steps = await BuildStep.find({ cabinet_guide_id: guideId })
      .sort({ step_order: 1 })
      .lean();

    return steps as IBuildStep[];
  },
};

// Export helper functions for testing
export { validateStepFields, reassignStepOrders };
