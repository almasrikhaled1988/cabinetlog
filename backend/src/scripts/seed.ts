import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../models/User';

const ADMIN_EMAIL = 'admin@cabinetlog.local';
const ADMIN_PASSWORD = 'changeme123';
const ADMIN_NAME = 'Admin';

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cabinetlog';

  console.log(`Connecting to MongoDB at ${uri}...`);
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  // Check if admin user already exists
  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

  if (existingAdmin) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
  } else {
    // Create initial admin user
    // The pre-save hook in the User model will hash the password automatically
    const admin = new User({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password_hash: ADMIN_PASSWORD,
      role: 'admin',
    });

    await admin.save();
    console.log(`Created admin user: ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`);
    console.log('⚠️  Change the admin password immediately in production!');
  }

  // Import remaining models
  const { CabinetGuide } = await import('../models/CabinetGuide');
  const { BuildStep } = await import('../models/BuildStep');
  const { StepMedia } = await import('../models/StepMedia');
  const { Tag } = await import('../models/Tag');

  // Ensure all indexes are created
  console.log('\nSyncing database indexes...');
  await User.ensureIndexes();
  console.log('  ✓ User indexes synced');
  await CabinetGuide.ensureIndexes();
  console.log('  ✓ CabinetGuide indexes synced');
  await BuildStep.ensureIndexes();
  console.log('  ✓ BuildStep indexes synced');
  await StepMedia.ensureIndexes();
  console.log('  ✓ StepMedia indexes synced');
  await Tag.ensureIndexes();
  console.log('  ✓ Tag indexes synced');

  // Create sample data if no guides exist
  const guideCount = await CabinetGuide.countDocuments();
  if (guideCount === 0) {
    console.log('\nCreating sample data...');

    // Get admin user ID
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });
    const adminId = adminUser!._id;

    // Create a worker user
    const existingWorker = await User.findOne({ email: 'worker@cabinetlog.local' });
    if (!existingWorker) {
      const worker = new User({
        name: 'Production Worker',
        email: 'worker@cabinetlog.local',
        password_hash: 'worker123',
        role: 'worker',
      });
      await worker.save();
      console.log('  ✓ Created worker user: worker@cabinetlog.local (password: worker123)');
    }

    // Create tags
    const tagNames = ['ATV630', 'ATV320', 'MCC', 'Water Cooling', 'Soft Starter', 'IP54', 'VSD'];
    const tags: any[] = [];
    for (const name of tagNames) {
      const existing = await Tag.findOne({ name: name.toLowerCase() });
      if (!existing) {
        const tag = await Tag.create({ name });
        tags.push(tag);
      } else {
        tags.push(existing);
      }
    }
    console.log(`  ✓ Created ${tags.length} tags`);

    // Create sample guides
    const sampleGuides = [
      {
        title: 'ATV630 VSD Cabinet Assembly',
        slug: 'atv630-vsd-cabinet-assembly',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Complete step-by-step assembly guide for ATV630 variable speed drive cabinets with water cooling system. Covers DIN rail mounting, drive installation, power wiring, and control connections.',
        status: 'published',
        version: 2,
        tags: [tags[0]._id, tags[3]._id, tags[6]._id],
        created_by: adminId,
      },
      {
        title: 'MCC Section Wiring Guide',
        slug: 'mcc-section-wiring-guide',
        cabinet_type: 'MCC',
        drive_model: '',
        description: 'Motor control center section wiring instructions. Includes bus bar connections, contactor wiring, and overload relay setup.',
        status: 'published',
        version: 1,
        tags: [tags[2]._id],
        created_by: adminId,
      },
      {
        title: 'ATV320 Control Panel Setup',
        slug: 'atv320-control-panel-setup',
        cabinet_type: 'Control Panel',
        drive_model: 'ATV320',
        description: 'Basic control panel assembly with ATV320 compact drive. Suitable for simple pump and fan applications.',
        status: 'published',
        version: 1,
        tags: [tags[1]._id, tags[5]._id],
        created_by: adminId,
      },
      {
        title: 'Soft Starter Cabinet IP54',
        slug: 'soft-starter-cabinet-ip54',
        cabinet_type: 'Custom',
        drive_model: 'ATS48',
        description: 'IP54 rated soft starter cabinet for outdoor installation. Includes ventilation, heating, and condensation prevention.',
        status: 'draft',
        version: 1,
        tags: [tags[4]._id, tags[5]._id],
        created_by: adminId,
      },
      {
        title: 'Water Cooling System Installation',
        slug: 'water-cooling-system-installation',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Detailed guide for installing the water cooling loop in high-power VSD cabinets. Covers pipe routing, pump connection, and leak testing.',
        status: 'draft',
        version: 1,
        tags: [tags[0]._id, tags[3]._id],
        created_by: adminId,
      },
    ];

    for (const guideData of sampleGuides) {
      const guide = await CabinetGuide.create(guideData);
      const guideId = guide._id;

      // Add sample steps to published guides
      if (guideData.status === 'published') {
        const steps = [
          { title: 'Prepare Backplate', description: 'Clean the backplate and mark mounting positions according to the layout drawing.', step_order: 1, estimated_time: 10, warning_notes: 'Wear safety glasses when drilling.' },
          { title: 'Mount DIN Rails', description: 'Install DIN rails at the marked positions. Use M5 bolts with spring washers.', step_order: 2, estimated_time: 15, warning_notes: 'Ensure rails are level before final tightening.' },
          { title: 'Install Main Components', description: 'Mount the drive, circuit breakers, and contactors on the DIN rails according to the layout.', step_order: 3, estimated_time: 30 },
          { title: 'Power Wiring', description: 'Connect the main power cables. Follow the wiring diagram for correct phase sequence.', step_order: 4, estimated_time: 45, warning_notes: 'Verify power is disconnected before wiring. Use torque wrench for terminal connections.' },
          { title: 'Control Wiring', description: 'Connect control signals, communication cables, and I/O wiring as per the schematic.', step_order: 5, estimated_time: 60 },
          { title: 'Final Inspection', description: 'Perform visual inspection, torque check on all connections, and insulation resistance test.', step_order: 6, estimated_time: 20, warning_notes: 'Document all test results in the quality checklist.' },
        ];

        for (const stepData of steps) {
          await BuildStep.create({ cabinet_guide_id: guideId, ...stepData });
        }
      }
    }
    console.log(`  ✓ Created ${sampleGuides.length} sample guides with build steps`);
  } else {
    console.log(`\nSample data already exists (${guideCount} guides found). Skipping.`);
  }

  console.log('\n✅ Seed complete.');
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
