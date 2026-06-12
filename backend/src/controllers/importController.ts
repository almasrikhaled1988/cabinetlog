import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { Tag } from '../models/Tag';

// ============================================================
// Markdown Parser (same logic as CLI script)
// ============================================================

interface ParsedChecklist {
  text: string;
  required: boolean;
}

interface ParsedStep {
  title: string;
  description: string;
  estimated_time?: number;
  warning_notes?: string;
  checklist_items: ParsedChecklist[];
}

interface ParsedGuide {
  title: string;
  cabinet_type: string;
  drive_model: string;
  description: string;
  tags: string[];
  steps: ParsedStep[];
}

function parseMarkdownGuide(content: string): ParsedGuide {
  const lines = content.split('\n');

  let title = '';
  let cabinetType = '';
  let driveModel = '';
  let description = '';
  let tags: string[] = [];
  const steps: ParsedStep[] = [];

  let currentSection: 'header' | 'description' | 'step' = 'header';
  let currentStep: ParsedStep | null = null;
  let stepContentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('# ') && !title) {
      title = line.replace(/^#\s+/, '').trim();
      currentSection = 'header';
      continue;
    }

    if (line.startsWith('## ')) {
      if (currentStep) {
        finalizeStep(currentStep, stepContentLines);
        steps.push(currentStep);
      }

      const stepTitle = line
        .replace(/^##\s+/, '')
        .replace(/^Schritt\s+\d+:\s*/i, '')
        .replace(/^Step\s+\d+:\s*/i, '')
        .trim();

      currentStep = { title: stepTitle, description: '', checklist_items: [] };
      stepContentLines = [];
      currentSection = 'step';
      continue;
    }

    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      continue;
    }

    if (currentSection === 'header' || (currentSection === 'description' && !currentStep)) {
      const metaMatch = line.match(/^[-*]?\s*\*\*(.+?):\*\*\s*(.+)/);
      if (metaMatch) {
        const key = metaMatch[1].trim().toLowerCase();
        const value = metaMatch[2].trim();

        if (['typ', 'type', 'cabinet type', 'schaltschranktyp'].includes(key)) {
          cabinetType = value;
        } else if (['antrieb', 'drive', 'drive model', 'modell'].includes(key)) {
          driveModel = value;
        } else if (['tags', 'labels', 'kategorien'].includes(key)) {
          tags = value.split(',').map((t) => t.trim()).filter(Boolean);
        }
        continue;
      }

      if (line.trim() && !line.startsWith('-') && !line.startsWith('*')) {
        currentSection = 'description';
        description += (description ? '\n' : '') + line.trim();
        continue;
      }

      if (currentSection === 'description' && line.trim() === '') {
        description += '\n';
        continue;
      }
      continue;
    }

    if (currentSection === 'step' && currentStep) {
      stepContentLines.push(line);
    }
  }

  if (currentStep) {
    finalizeStep(currentStep, stepContentLines);
    steps.push(currentStep);
  }

  description = description.trim();
  return { title, cabinet_type: cabinetType, drive_model: driveModel, description, tags, steps };
}

function finalizeStep(step: ParsedStep, lines: string[]): void {
  const descriptionLines: string[] = [];

  for (const line of lines) {
    const timeMatch = line.match(/^\*\*(?:Zeit|Time|Dauer):\*\*\s*(\d+)\s*(?:min|minutes?|Minuten)?/i);
    if (timeMatch) {
      step.estimated_time = parseInt(timeMatch[1], 10);
      continue;
    }

    const warningMatch = line.match(/^>\s*(?:⚠️\s*)?(?:\*\*(?:Warnung|Warning|Achtung|Hinweis):\*\*\s*)?(.+)/i);
    if (warningMatch && line.startsWith('>')) {
      const warningText = warningMatch[1].trim();
      if (warningText) {
        step.warning_notes = step.warning_notes ? step.warning_notes + ' ' + warningText : warningText;
      }
      continue;
    }

    const checkMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)/);
    if (checkMatch) {
      let text = checkMatch[2].trim();
      const isRequired =
        text.toLowerCase().includes('(pflicht)') ||
        text.toLowerCase().includes('(required)') ||
        text.toLowerCase().includes('(muss)') ||
        checkMatch[1].toLowerCase() === 'x';

      text = text.replace(/\s*\((?:Pflicht|required|muss)\)\s*/gi, '').trim();
      step.checklist_items.push({ text, required: isRequired });
      continue;
    }

    if (line.trim()) {
      descriptionLines.push(line.trim());
    }
  }

  step.description = descriptionLines.join('\n').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

// ============================================================
// Controller
// ============================================================

export async function importMarkdown(req: Request, res: Response): Promise<void> {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: { message: 'Markdown content is required (send as "content" field).' } });
      return;
    }

    const parsed = parseMarkdownGuide(content);

    if (!parsed.title) {
      res.status(400).json({ error: { message: 'Could not find guide title. Use "# Title" as the first line.' } });
      return;
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }

    // Resolve or create tags
    const tagIds: mongoose.Types.ObjectId[] = [];
    for (const tagName of parsed.tags) {
      let tag = await Tag.findOne({ name: { $regex: new RegExp(`^${tagName}$`, 'i') } });
      if (!tag) {
        tag = await Tag.create({ name: tagName });
      }
      tagIds.push(tag._id as mongoose.Types.ObjectId);
    }

    // Generate unique slug
    let slug = slugify(parsed.title);
    const existingGuide = await CabinetGuide.findOne({ slug });
    if (existingGuide) {
      slug = slug + '-' + Date.now();
    }

    // Create guide
    const guide = await CabinetGuide.create({
      title: parsed.title,
      slug,
      cabinet_type: parsed.cabinet_type || 'Custom',
      drive_model: parsed.drive_model || '',
      description: parsed.description,
      status: 'draft',
      version: 1,
      tags: tagIds,
      created_by: userId,
    });

    // Create steps
    const createdSteps = [];
    for (let i = 0; i < parsed.steps.length; i++) {
      const stepData = parsed.steps[i];
      const step = await BuildStep.create({
        cabinet_guide_id: guide._id,
        title: stepData.title,
        description: stepData.description,
        step_order: i + 1,
        estimated_time: stepData.estimated_time || undefined,
        warning_notes: stepData.warning_notes || undefined,
        checklist_items: stepData.checklist_items.length > 0 ? stepData.checklist_items : undefined,
      });
      createdSteps.push(step);
    }

    res.status(201).json({
      message: `Guide "${parsed.title}" imported successfully with ${createdSteps.length} steps.`,
      guide: {
        _id: guide._id,
        title: guide.title,
        slug: guide.slug,
        status: guide.status,
        steps_count: createdSteps.length,
      },
    });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ error: { message: 'A guide with this title already exists.' } });
      return;
    }
    res.status(500).json({ error: { message: err.message || 'Import failed.' } });
  }
}
