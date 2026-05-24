import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/searchService';
import { SearchFilters } from '../types/filters';

/**
 * GET /api/guides/search
 * Search guides with text query and filters.
 * Workers only see published guides.
 *
 * Query params:
 * - q: search text (1-200 chars)
 * - cabinetType: filter by cabinet type
 * - driveModel: filter by drive model
 * - tags: comma-separated tag IDs
 */
export async function searchGuides(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = req.query.q as string | undefined;
    const filters: SearchFilters = {};

    // Parse filter params
    if (req.query.cabinetType) {
      filters.cabinetType = req.query.cabinetType as string;
    }
    if (req.query.driveModel) {
      filters.driveModel = req.query.driveModel as string;
    }
    if (req.query.tags) {
      const tagsParam = req.query.tags;
      if (typeof tagsParam === 'string') {
        filters.tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
      } else if (Array.isArray(tagsParam)) {
        filters.tags = tagsParam as string[];
      }
    }

    // Pass user role to search service for status filtering
    const userRole = req.user?.role as 'admin' | 'worker' | undefined;

    const results = await searchService.searchGuides(query, filters, userRole);
    res.status(200).json({ data: results });
  } catch (error) {
    next(error);
  }
}
