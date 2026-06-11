import { Request, Response, NextFunction } from 'express';
import { stepService } from '../services/stepService';
import { CreateStepDTO, UpdateStepDTO } from '../types/dto';

/**
 * POST /api/guides/:guideId/steps
 * Create a new build step for a guide. Admin only.
 */
export async function createStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const data: CreateStepDTO = {
      title: req.body.title,
      description: req.body.description || '',
      step_order: req.body.step_order,
      estimated_time: req.body.estimated_time,
      warning_notes: req.body.warning_notes,
      checklist_items: req.body.checklist_items,
    };

    const step = await stepService.createStep(guideId, data);
    res.status(201).json(step);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/steps/:id
 * Update an existing build step. Admin only.
 */
export async function updateStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stepId = req.params.id as string;
    const data: UpdateStepDTO = {};

    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.step_order !== undefined) data.step_order = req.body.step_order;
    if (req.body.estimated_time !== undefined) data.estimated_time = req.body.estimated_time;
    if (req.body.warning_notes !== undefined) data.warning_notes = req.body.warning_notes;
    if (req.body.checklist_items !== undefined) data.checklist_items = req.body.checklist_items;

    const step = await stepService.updateStep(stepId, data);
    res.status(200).json(step);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/steps/:id
 * Delete a build step with media cascade. Admin only.
 */
export async function deleteStep(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stepId = req.params.id as string;
    await stepService.deleteStep(stepId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/guides/:guideId/steps/reorder
 * Reorder all steps in a guide. Admin only.
 * Accepts either { stepIds: string[] } or { steps: [{stepId, step_order}] }
 */
export async function reorderSteps(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    let stepIds: string[];

    if (req.body.stepIds) {
      stepIds = req.body.stepIds;
    } else if (req.body.steps && Array.isArray(req.body.steps)) {
      // Sort by step_order and extract IDs
      const sorted = [...req.body.steps].sort(
        (a: any, b: any) => a.step_order - b.step_order
      );
      stepIds = sorted.map((s: any) => s.stepId);
    } else {
      stepIds = [];
    }

    const steps = await stepService.reorderSteps(guideId, stepIds);
    res.status(200).json(steps);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/guides/:guideId/steps
 * Get all steps for a guide, sorted by step_order ascending.
 */
export async function getStepsByGuide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const steps = await stepService.getStepsByGuide(guideId);
    res.status(200).json(steps);
  } catch (error) {
    next(error);
  }
}
