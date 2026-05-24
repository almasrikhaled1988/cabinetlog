import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../models/User';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { Tag } from '../models/Tag';

async function createIndexes(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cabinetlog';

  console.log(`Connecting to MongoDB at ${uri}...`);
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.\n');

  console.log('Syncing all Mongoose model indexes...\n');

  // User indexes:
  //   - email: unique (case-insensitive collation)
  await User.ensureIndexes();
  console.log('User indexes:');
  console.log('  • email (unique, case-insensitive)');

  // CabinetGuide indexes:
  //   - slug: unique
  //   - text index on title, description, drive_model, cabinet_type (weighted)
  //   - status + updated_at (for listing/filtering)
  await CabinetGuide.ensureIndexes();
  console.log('CabinetGuide indexes:');
  console.log('  • slug (unique)');
  console.log('  • text search: title(10), drive_model(5), cabinet_type(5), description(1)');
  console.log('  • status + updated_at (compound)');

  // BuildStep indexes:
  //   - cabinet_guide_id + step_order: unique compound
  await BuildStep.ensureIndexes();
  console.log('BuildStep indexes:');
  console.log('  • cabinet_guide_id + step_order (unique compound)');

  // StepMedia indexes:
  //   - build_step_id + sort_order
  await StepMedia.ensureIndexes();
  console.log('StepMedia indexes:');
  console.log('  • build_step_id + sort_order (compound)');

  // Tag indexes:
  //   - name: unique (case-insensitive collation)
  await Tag.ensureIndexes();
  console.log('Tag indexes:');
  console.log('  • name (unique, case-insensitive)');

  console.log('\n✅ All indexes synced successfully.');
  await mongoose.disconnect();
}

createIndexes().catch((error) => {
  console.error('Index creation failed:', error);
  process.exit(1);
});
