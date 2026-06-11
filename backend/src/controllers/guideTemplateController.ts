import { Request, Response, NextFunction } from 'express';
import { guideTemplateService } from '../services/guideTemplateService';
import { auditService } from '../services/auditService';

/**
 * POST /api/guides/:id/duplicate
 */
export async function duplicateGuide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { title } = req.body;
    const userId = req.user!.userId;

    const newGuide = await guideTemplateService.duplicateGuide(id, userId, title);

    await auditService.log({
      userId,
      action: 'guide_duplicate',
      resourceType: 'guide',
      resourceId: (newGuide._id as any).toString(),
      details: { sourceGuideId: id },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(newGuide);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/guides/templates
 */
export async function getTemplates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const templates = await guideTemplateService.getTemplates();
    res.status(200).json(templates);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/guides/:id/template
 */
export async function toggleTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { isTemplate } = req.body;

    const guide = await guideTemplateService.toggleTemplate(id, isTemplate);
    res.status(200).json(guide);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/guides/:id/versions
 */
export async function getVersionHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const versions = await guideTemplateService.getVersionHistory(id);
    res.status(200).json(versions);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/guides/:id/versions/:version
 */
export async function getVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const version = req.params.version as string;
    const versionDoc = await guideTemplateService.getVersion(id, parseInt(version));
    res.status(200).json(versionDoc);
  } catch (error) {
    next(error);
  }
}
