import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function reset(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:changeme@localhost:27017/werkflow?authSource=admin';
  console.log(`Connecting to MongoDB at ${uri}...`);
  await mongoose.connect(uri);
  console.log('Connected. Dropping database...');
  await mongoose.connection.dropDatabase();
  console.log('Database dropped successfully.');
  await mongoose.disconnect();
}

reset().catch((error) => {
  console.error('Reset failed:', error.message);
  process.exit(1);
});
