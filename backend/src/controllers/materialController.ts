import { Request, Response, NextFunction } from 'express';
import { materialService } from '../services/materialService';

/**
 * GET /api/guides/:guideId/materials
 */
export async function getMaterials(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const materials = await materialService.getByGuide(guideId);
    res.status(200).json(materials);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/guides/:guideId/materials
 */
export async function createMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const guideId = req.params.guideId as string;
    const { name, quantity, unit, category, part_number } = req.body;

    if (!name || !category) {
      res.status(400).json({
        error: { message: 'Name and category are required', status: 400 },
      });
      return;
    }

    const material = await materialService.create(guideId, {
      name,
      quantity: quantity || 1,
      unit: unit || 'pcs',
      category,
      part_number,
    });

    res.status(201).json(material);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/materials/:id
 */
export async function updateMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const material = await materialService.update(id, req.body);
    res.status(200).json(material);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/materials/:id
 */
export async function deleteMaterial(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    await materialService.delete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
