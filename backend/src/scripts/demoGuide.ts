/**
 * Demo Guide Creator
 * Creates a sample guide with real images for boss presentation.
 * Run: npx ts-node src/scripts/demoGuide.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../models/User';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { uploadService } from '../services/uploadService';

const IMAGES_DIR = path.resolve(__dirname, '../../../images');

// Map images to assembly steps
const DEMO_STEPS = [
  {
    title: 'Backplate Preparation & Layout',
    description: 'Inspect the backplate for damage. Mark mounting positions for DIN rails, cable ducts, and main components according to the layout drawing. Ensure all measurements are correct before drilling.',
    estimated_time: 15,
    warning_notes: 'Wear safety glasses when drilling. Double-check measurements against the layout drawing before making any holes.',
    image: '20260521_103829.jpg',
  },
  {
    title: 'DIN Rail & Cable Duct Installation',
    description: 'Mount DIN rails at marked positions using M5 bolts with spring washers. Install cable ducts along the sides and bottom. Ensure rails are level and properly spaced for component clearance.',
    estimated_time: 20,
    warning_notes: 'Ensure all DIN rails are level before final tightening. Use torque wrench for consistent bolt tension.',
    image: '20260521_110600.jpg',
  },
  {
    title: 'Main Component Mounting',
    description: 'Install the main circuit breaker, contactors, and overload relays on the DIN rails. Follow the layout drawing for exact positioning. Leave adequate spacing for heat dissipation.',
    estimated_time: 25,
    warning_notes: 'Check component orientation before mounting. Some devices are position-sensitive for proper cooling.',
    image: '20260521_110742.jpg',
  },
  {
    title: 'Drive Unit Installation',
    description: 'Mount the variable speed drive (VSD) unit in the designated position. Connect the cooling system if applicable. Verify mounting bracket alignment and secure with all specified fasteners.',
    estimated_time: 30,
    warning_notes: 'Handle the drive unit carefully — it is heavy and sensitive to static discharge. Use ESD protection.',
    image: '20260521_111007.jpg',
  },
  {
    title: 'Power Wiring & Bus Bar Connections',
    description: 'Route and connect main power cables according to the wiring diagram. Install bus bars for power distribution. Ensure correct phase sequence (L1, L2, L3). Apply proper cable management with ties and markers.',
    estimated_time: 45,
    warning_notes: 'VERIFY POWER IS DISCONNECTED before any wiring work. Use calibrated torque wrench for all terminal connections. Follow specified torque values.',
    image: '20260521_124200.jpg',
  },
  {
    title: 'Control Wiring & Signal Connections',
    description: 'Connect all control signals, communication cables (Modbus/Profibus), and I/O wiring as per the control schematic. Label all wires with ferrules. Route control cables separately from power cables.',
    estimated_time: 60,
    warning_notes: 'Keep minimum 100mm separation between control and power cables to avoid electromagnetic interference.',
    image: '20260521_153827.jpg',
  },
  {
    title: 'Cable Management & Dressing',
    description: 'Organize all cables in cable ducts. Apply cable ties at regular intervals. Install strain relief on all external cable entries. Ensure no cables are pinched or under tension.',
    estimated_time: 30,
    image: '20260521_154150.jpg',
  },
  {
    title: 'Final Inspection & Testing',
    description: 'Perform visual inspection of all connections. Check torque on all power terminals. Perform insulation resistance test (Megger). Verify control circuit continuity. Document all test results in the quality checklist.',
    estimated_time: 25,
    warning_notes: 'Complete ALL checks before applying power. Record all test measurements in the inspection report. Get sign-off from supervisor.',
    image: '20260521_154347.jpg',
  },
];

async function createDemoGuide(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cabinetlog';
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri);
  console.log('Connected.\n');

  // Get admin user
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.error('No admin user found. Run npm run seed first.');
    process.exit(1);
  }

  // Check if demo guide already exists
  const existing = await CabinetGuide.findOne({ slug: 'vsd-cabinet-assembly-demo' });
  if (existing) {
    console.log('Demo guide already exists. Deleting and recreating...');
    const steps = await BuildStep.find({ cabinet_guide_id: existing._id });
    const stepIds = steps.map(s => s._id);
    const media = await StepMedia.find({ build_step_id: { $in: stepIds } });
    
    // Delete Cloudinary files
    for (const m of media) {
      await uploadService.deleteFile(m.file_path);
    }
    await StepMedia.deleteMany({ build_step_id: { $in: stepIds } });
    await BuildStep.deleteMany({ cabinet_guide_id: existing._id });
    await CabinetGuide.findByIdAndDelete(existing._id);
    console.log('Old demo guide deleted.\n');
  }

  // Create the guide
  console.log('Creating demo guide...');
  const guide = await CabinetGuide.create({
    title: 'VSD Cabinet Assembly — Complete Build Guide',
    slug: 'vsd-cabinet-assembly-demo',
    cabinet_type: 'VSD',
    drive_model: 'ATV630',
    description: 'Complete step-by-step assembly guide for a Variable Speed Drive (VSD) cabinet with ATV630 drive unit. This guide covers the full build process from backplate preparation through final testing and commissioning. Designed for production workers with basic electrical assembly experience.',
    status: 'published',
    version: 1,
    created_by: admin._id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`  ✓ Guide created: "${guide.title}"`);
  console.log(`    ID: ${guide._id}`);
  console.log(`    Status: published\n`);

  // Create steps with images
  console.log('Creating build steps with images...\n');

  for (let i = 0; i < DEMO_STEPS.length; i++) {
    const stepData = DEMO_STEPS[i];
    const stepOrder = i + 1;

    // Create the step
    const step = await BuildStep.create({
      cabinet_guide_id: guide._id,
      title: stepData.title,
      description: stepData.description,
      step_order: stepOrder,
      estimated_time: stepData.estimated_time,
      warning_notes: stepData.warning_notes,
    });

    console.log(`  Step ${stepOrder}: ${stepData.title}`);

    // Upload the image
    const imagePath = path.join(IMAGES_DIR, stepData.image);
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      const file = {
        fieldname: 'file',
        originalname: stepData.image,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: imageBuffer.length,
        buffer: imageBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      } as Express.Multer.File;

      try {
        const media = await uploadService.uploadImage(file, (step._id as mongoose.Types.ObjectId).toString());
        console.log(`    ✓ Image uploaded: ${media.file_path.substring(0, 60)}...`);
      } catch (err: any) {
        console.error(`    ✗ Image upload failed: ${err.message}`);
      }
    } else {
      console.log(`    ⚠ Image not found: ${stepData.image}`);
    }
  }

  console.log(`\n✅ Demo guide created successfully!`);
  console.log(`\n   Open in browser: http://localhost:3000/guides/${guide._id}`);
  console.log(`   Login as admin: admin@cabinetlog.local / changeme123`);
  console.log(`   Login as worker: worker@cabinetlog.local / worker123\n`);

  await mongoose.disconnect();
}

createDemoGuide().catch((error) => {
  console.error('Demo guide creation failed:', error);
  process.exit(1);
});
