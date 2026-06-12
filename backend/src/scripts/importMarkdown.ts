import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../models/User';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { Tag } from '../models/Tag';

// ============================================================
// Markdown Guide Parser
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

    // H1 = Guide Title
    if (line.startsWith('# ') && !title) {
      title = line.replace(/^#\s+/, '').trim();
      currentSection = 'header';
      continue;
    }

    // H2 = Step
    if (line.startsWith('## ')) {
      // Save previous step
      if (currentStep) {
        finalizeStep(currentStep, stepContentLines);
        steps.push(currentStep);
      }

      const stepTitle = line
        .replace(/^##\s+/, '')
        .replace(/^Schritt\s+\d+:\s*/i, '')  // Remove "Schritt 1: " prefix
        .replace(/^Step\s+\d+:\s*/i, '')      // Remove "Step 1: " prefix
        .trim();

      currentStep = {
        title: stepTitle,
        description: '',
        checklist_items: [],
      };
      stepContentLines = [];
      currentSection = 'step';
      continue;
    }

    // Horizontal rule = step separator (ignore)
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      continue;
    }

    // Parse metadata in header section
    if (currentSection === 'header' || (currentSection === 'description' && !currentStep)) {
      // Metadata lines: "- **Key:** Value" or "**Key:** Value"
      const metaMatch = line.match(/^[-*]?\s*\*\*(.+?):\*\*\s*(.+)/);
      if (metaMatch) {
        const key = metaMatch[1].trim().toLowerCase();
        const value = metaMatch[2].trim();

        if (key === 'typ' || key === 'type' || key === 'cabinet type' || key === 'schaltschranktyp') {
          cabinetType = value;
        } else if (key === 'antrieb' || key === 'drive' || key === 'drive model' || key === 'modell') {
          driveModel = value;
        } else if (key === 'tags' || key === 'labels' || key === 'kategorien') {
          tags = value.split(',').map((t) => t.trim()).filter(Boolean);
        }
        continue;
      }

      // Non-empty lines after metadata = description
      if (line.trim() && !line.startsWith('-') && !line.startsWith('*')) {
        currentSection = 'description';
        description += (description ? '\n' : '') + line.trim();
        continue;
      }

      // Empty line in description keeps going
      if (currentSection === 'description' && line.trim() === '') {
        description += '\n';
        continue;
      }

      continue;
    }

    // Inside a step
    if (currentSection === 'step' && currentStep) {
      stepContentLines.push(line);
    }
  }

  // Finalize last step
  if (currentStep) {
    finalizeStep(currentStep, stepContentLines);
    steps.push(currentStep);
  }

  // Clean up description
  description = description.trim();

  return { title, cabinet_type: cabinetType, drive_model: driveModel, description, tags, steps };
}

function finalizeStep(step: ParsedStep, lines: string[]): void {
  const descriptionLines: string[] = [];

  for (const line of lines) {
    // Time: "**Zeit:** 15 min" or "**Time:** 15 min"
    const timeMatch = line.match(/^\*\*(?:Zeit|Time|Dauer):\*\*\s*(\d+)\s*(?:min|minutes?|Minuten)?/i);
    if (timeMatch) {
      step.estimated_time = parseInt(timeMatch[1], 10);
      continue;
    }

    // Warning: "> ⚠️ ..." or "> **Warnung:** ..." or "> **Warning:** ..."
    const warningMatch = line.match(/^>\s*(?:⚠️\s*)?(?:\*\*(?:Warnung|Warning|Achtung|Hinweis):\*\*\s*)?(.+)/i);
    if (warningMatch && line.startsWith('>')) {
      const warningText = warningMatch[1].trim();
      if (warningText) {
        step.warning_notes = step.warning_notes
          ? step.warning_notes + ' ' + warningText
          : warningText;
      }
      continue;
    }

    // Checklist: "- [x] Text (Pflicht)" or "- [ ] Text"
    const checkMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)/);
    if (checkMatch) {
      let text = checkMatch[2].trim();
      const isRequired = text.toLowerCase().includes('(pflicht)') ||
                          text.toLowerCase().includes('(required)') ||
                          text.toLowerCase().includes('(muss)') ||
                          checkMatch[1].toLowerCase() === 'x';

      // Remove the (Pflicht) / (required) suffix from text
      text = text
        .replace(/\s*\((?:Pflicht|required|muss)\)\s*/gi, '')
        .trim();

      step.checklist_items.push({ text, required: isRequired });
      continue;
    }

    // Regular description line
    if (line.trim()) {
      descriptionLines.push(line.trim());
    }
  }

  step.description = descriptionLines.join('\n').trim();
}

// ============================================================
// Database Import
// ============================================================

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

async function importGuide(parsed: ParsedGuide, adminUserId: mongoose.Types.ObjectId): Promise<void> {
  // Resolve or create tags
  const tagIds: mongoose.Types.ObjectId[] = [];
  for (const tagName of parsed.tags) {
    let tag = await Tag.findOne({ name: { $regex: new RegExp(`^${tagName}$`, 'i') } });
    if (!tag) {
      tag = await Tag.create({ name: tagName });
      console.log(`    Created tag: "${tagName}"`);
    }
    tagIds.push(tag._id as mongoose.Types.ObjectId);
  }

  // Generate slug
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
    created_by: adminUserId,
  });

  console.log(`  ✓ Created guide: "${parsed.title}" (${parsed.steps.length} steps)`);

  // Create steps
  for (let i = 0; i < parsed.steps.length; i++) {
    const stepData = parsed.steps[i];
    await BuildStep.create({
      cabinet_guide_id: guide._id,
      title: stepData.title,
      description: stepData.description,
      step_order: i + 1,
      estimated_time: stepData.estimated_time || undefined,
      warning_notes: stepData.warning_notes || undefined,
      checklist_items: stepData.checklist_items.length > 0 ? stepData.checklist_items : undefined,
    });
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const guidesDir = path.resolve(__dirname, '../../guides');

  // Check if guides directory exists
  if (!fs.existsSync(guidesDir)) {
    fs.mkdirSync(guidesDir, { recursive: true });
    console.log(`Created guides directory: ${guidesDir}`);
    console.log('Put your .md files there and run this script again.');
    console.log('\nSee guides/TEMPLATE.md for the expected format.');
    process.exit(0);
  }

  // Find all .md files
  const mdFiles = fs.readdirSync(guidesDir).filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md');

  if (mdFiles.length === 0) {
    console.log('No .md files found in guides/ directory.');
    console.log(`Put your markdown files in: ${guidesDir}`);
    process.exit(0);
  }

  console.log(`Found ${mdFiles.length} markdown file(s) to import.\n`);

  // Connect to DB
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/werkflow';
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri);
  console.log('Connected.\n');

  // Find admin user
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.error('ERROR: No admin user found. Run "npm run seed" first.');
    process.exit(1);
  }

  const adminId = admin._id as mongoose.Types.ObjectId;
  let imported = 0;
  let failed = 0;

  for (const file of mdFiles) {
    const filePath = path.join(guidesDir, file);
    console.log(`📄 Importing: ${file}`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseMarkdownGuide(content);

      if (!parsed.title) {
        console.log(`  ⚠️  Skipped (no title found). Use "# Title" as first line.`);
        failed++;
        continue;
      }

      if (parsed.steps.length === 0) {
        console.log(`  ⚠️  Warning: No steps found. Guide created without steps.`);
      }

      await importGuide(parsed, adminId);
      imported++;

      // Move file to "imported" subfolder
      const importedDir = path.join(guidesDir, 'imported');
      if (!fs.existsSync(importedDir)) {
        fs.mkdirSync(importedDir, { recursive: true });
      }
      fs.renameSync(filePath, path.join(importedDir, file));
      console.log(`    → Moved to guides/imported/\n`);
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}\n`);
      failed++;
    }
  }

  console.log('─'.repeat(40));
  console.log(`✅ Done. Imported: ${imported}, Failed: ${failed}`);
  console.log('Guides are created as "draft". Publish them from the admin panel.');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
