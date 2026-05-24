import { Request, Response, NextFunction } from 'express';
import { guideService, transitionGuideStatus } from '../services/guideService';
import { CreateGuideDTO, UpdateGuideDTO } from '../types/dto';
import { GuideFilters } from '../types/filters';

/**
 * POST /api/guides
 * Create a new guide. Admin only.
 */
export async function createGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const data: CreateGuideDTO = {
      title: req.body.title,
      cabinet_type: req.body.cabinet_type,
      drive_model: req.body.drive_model || '',
      description: req.body.description || '',
      thumbnail_image: req.body.thumbnail_image,
      tags: req.body.tags,
    };

    const guide = await guideService.createGuide(data, userId);
    res.status(201).json(guide);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/guides
 * List guides with pagination and filters.
 * Workers only see published guides.
 */
export async function getGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters: GuideFilters = {};

    // Parse pagination params
    if (req.query.page !== undefined) {
      const page = Number(req.query.page);
      filters.page = Number.isNaN(page) ? undefined : page;
    }
    if (req.query.limit !== undefined) {
      const limit = Number(req.query.limit);
      filters.limit = Number.isNaN(limit) ? undefined : limit;
    }

    // Parse filter params
    if (req.query.cabinetType) {
      filters.cabinetType = req.query.cabinetType as string;
    }
    if (req.query.driveModel) {
      filters.driveModel = req.query.driveModel as string;
    }
    if (req.query.tags) {
      const tagsParam = req.query.tags;
      if (Array.isArray(tagsParam)) {
        filters.tags = tagsParam as string[];
      } else if (typeof tagsParam === 'string') {
        filters.tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // Workers can only see published guides (Requirement 8.6)
    if (req.user && req.user.role === 'worker') {
      filters.status = 'published';
    } else if (req.query.status) {
      filters.status = req.query.status as GuideFilters['status'];
    }

    const result = await guideService.getGuides(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/guides/:id
 * Get a single guide with populated steps.
 */
export async function getGuideById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const guide = await guideService.getGuideById(id);
    res.status(200).json(guide);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/guides/:id
 * Update a guide. Admin only.
 */
export async function updateGuide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const data: UpdateGuideDTO = {};

    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.cabinet_type !== undefined) data.cabinet_type = req.body.cabinet_type;
    if (req.body.drive_model !== undefined) data.drive_model = req.body.drive_model;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.thumbnail_image !== undefined) data.thumbnail_image = req.body.thumbnail_image;
    if (req.body.tags !== undefined) data.tags = req.body.tags;

    const guide = await guideService.updateGuide(id, data);
    res.status(200).json(guide);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/guides/:id/status
 * Transition guide status. Admin only.
 */
export async function transitionStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const guide = await transitionGuideStatus(id, status);
    res.status(200).json(guide);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/guides/:id
 * Delete a guide with cascade. Admin only.
 */
export async function deleteGuide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    await guideService.deleteGuide(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
