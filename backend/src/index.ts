import dotenv from 'dotenv';

dotenv.config();

import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 4000;

async function start(): Promise<void> {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`CabinetLog Backend running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
