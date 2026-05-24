import { Request, Response, NextFunction } from 'express';
import { uploadService } from '../services/uploadService';
import { StepMedia } from '../models/StepMedia';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';

/**
 * POST /api/upload/image
 * Upload an image file for a build step. Admin only.
 * Expects multipart form data with a single file field 'file' and a 'buildStepId' body field.
 */
export async function uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const { buildStepId } = req.body;
    if (!buildStepId) {
      throw new ValidationError('buildStepId is required');
    }

    const media = await uploadService.uploadImage(req.file, buildStepId);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/upload/pdf
 * Upload a PDF file for a build step. Admin only.
 * Expects multipart form data with a single file field 'file' and a 'buildStepId' body field.
 */
export async function uploadPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const { buildStepId } = req.body;
    if (!buildStepId) {
      throw new ValidationError('buildStepId is required');
    }

    const media = await uploadService.uploadPDF(req.file, buildStepId);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/upload/:id
 * Delete a media file by its StepMedia ID. Admin only.
 * Removes the file from the filesystem and the database record.
 */
export async function deleteMedia(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const media = await StepMedia.findById(id);
    if (!media) {
      throw new NotFoundError('Media file not found');
    }

    // Delete file from filesystem
    await uploadService.deleteFile(media.file_path);

    // Delete database record
    await StepMedia.findByIdAndDelete(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/upload/step/:stepId or GET /api/steps/:id/media
 * Get all media files for a build step, sorted by sort_order.
 */
export async function getMediaByStep(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stepId = req.params.stepId || req.params.id;
    const media = await StepMedia.find({ build_step_id: stepId })
      .sort({ sort_order: 1 })
      .lean();
    res.status(200).json(media);
  } catch (error) {
    next(error);
  }
}
