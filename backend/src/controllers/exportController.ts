import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { GuideMaterial } from '../models/GuideMaterial';
import { NotFoundError } from '../middleware/errorHandler';

/**
 * GET /api/export/guides/:id/pdf
 * Generate a PDF of a complete guide.
 */
export async function exportGuidePDF(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const guide = await CabinetGuide.findById(id).populate('tags', 'name');
    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    const steps = await BuildStep.find({ cabinet_guide_id: id }).sort({ step_order: 1 }).lean();
    const materials = await GuideMaterial.find({ guide_id: id }).sort({ sort_order: 1 }).lean();

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${guide.slug || 'guide'}.pdf"`
    );

    doc.pipe(res);

    // Title page
    doc.fontSize(24).font('Helvetica-Bold').text(guide.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica').text(`Cabinet Type: ${guide.cabinet_type}`, { align: 'center' });
    if (guide.drive_model) {
      doc.text(`Drive Model: ${guide.drive_model}`, { align: 'center' });
    }
    doc.moveDown();
    doc.fontSize(10).text(`Version: ${guide.version}`, { align: 'center' });
    doc.text(`Status: ${guide.status}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, { align: 'center' });

    if (guide.description) {
      doc.moveDown(2);
      doc.fontSize(11).font('Helvetica').text(guide.description);
    }

    // Tags
    if (guide.tags && guide.tags.length > 0) {
      doc.moveDown();
      const tagNames = (guide.tags as any[]).map((t: any) => t.name || t).join(', ');
      doc.fontSize(10).font('Helvetica-Oblique').text(`Tags: ${tagNames}`);
    }

    // Materials section
    if (materials.length > 0) {
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('Tools & Materials');
      doc.moveDown();

      const categories = ['tool', 'component', 'consumable'] as const;
      const categoryLabels = { tool: 'Tools', component: 'Components', consumable: 'Consumables' };

      for (const cat of categories) {
        const items = materials.filter((m) => m.category === cat);
        if (items.length === 0) continue;

        doc.fontSize(13).font('Helvetica-Bold').text(categoryLabels[cat]);
        doc.moveDown(0.5);

        for (const item of items) {
          const line = `• ${item.name} — ${item.quantity} ${item.unit}${item.part_number ? ` (${item.part_number})` : ''}`;
          doc.fontSize(10).font('Helvetica').text(line);
        }
        doc.moveDown();
      }
    }

    // Steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      doc.addPage();

      // Step header
      doc.fontSize(12).font('Helvetica').fillColor('#666666').text(`Step ${step.step_order} of ${steps.length}`);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(step.title);
      doc.moveDown();

      // Estimated time
      if (step.estimated_time) {
        doc.fontSize(10).font('Helvetica-Oblique').text(`Estimated time: ${step.estimated_time} min`);
        doc.moveDown(0.5);
      }

      // Warning
      if (step.warning_notes) {
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#B45309').text('⚠ WARNING');
        doc.font('Helvetica').text(step.warning_notes);
        doc.fillColor('#000000');
        doc.moveDown();
      }

      // Description
      if (step.description) {
        doc.fontSize(11).font('Helvetica').text(step.description);
      }

      // Checklist
      if (step.checklist_items && step.checklist_items.length > 0) {
        doc.moveDown();
        doc.fontSize(11).font('Helvetica-Bold').text('Checklist:');
        for (const item of step.checklist_items) {
          const prefix = item.required ? '☐ [Required]' : '☐';
          doc.fontSize(10).font('Helvetica').text(`${prefix} ${item.text}`);
        }
      }
    }

    // Summary page
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('Summary');
    doc.moveDown();
    doc.fontSize(11).font('Helvetica').text(`Total Steps: ${steps.length}`);

    const totalTime = steps.reduce((sum, s) => sum + (s.estimated_time || 0), 0);
    if (totalTime > 0) {
      const hours = Math.floor(totalTime / 60);
      const mins = totalTime % 60;
      doc.text(`Total Estimated Time: ${hours > 0 ? `${hours}h ` : ''}${mins}min`);
    }

    doc.end();
  } catch (error) {
    next(error);
  }
}
