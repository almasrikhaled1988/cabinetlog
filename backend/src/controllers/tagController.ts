import { Request, Response, NextFunction } from 'express';
import { Tag } from '../models/Tag';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';

/**
 * POST /api/tags
 * Create a new tag. Admin only.
 * Validates tag name is unique (case-insensitive) and 1-50 characters.
 *
 * Requirement 12.4: Tag names are unique case-insensitive, 1-50 characters.
 */
export async function createTag(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.body;

    // Validate name presence and type
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Validation failed', {
        name: 'Tag name is required',
      });
    }

    const trimmedName = name.trim();

    // Validate length
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      throw new ValidationError('Validation failed', {
        name: 'Tag name must be between 1 and 50 characters',
      });
    }

    // Check for duplicate (case-insensitive)
    const existing = await Tag.findOne({
      name: trimmedName.toLowerCase(),
    });
    if (existing) {
      throw new ValidationError('Validation failed', {
        name: 'Tag name already exists',
      });
    }

    const tag = await Tag.create({ name: trimmedName });
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tags
 * List all tags sorted by name ascending.
 */
export async function getTags(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tags = await Tag.find().sort({ name: 1 }).lean();
    res.status(200).json({ data: tags });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/tags/:id
 * Delete a tag by ID. Admin only.
 */
export async function deleteTag(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const tag = await Tag.findById(id);
    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    await Tag.findByIdAndDelete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
