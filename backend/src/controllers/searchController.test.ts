import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { CabinetGuide } from '../models/CabinetGuide';
import { Tag } from '../models/Tag';
import { User } from '../models/User';
import '../models/Tag'; // Register Tag model for populate

let mongoServer: MongoMemoryServer;
let adminToken: string;
let workerToken: string;
let adminUserId: string;

const JWT_SECRET = 'test-secret';

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Create admin user
  const admin = await User.create({
    name: 'Test Admin',
    email: 'admin@test.com',
    password_hash: '$2a$12$hashedpassword',
    role: 'admin',
  });
  adminUserId = (admin._id as mongoose.Types.ObjectId).toString();

  // Create worker user
  const worker = await User.create({
    name: 'Test Worker',
    email: 'worker@test.com',
    password_hash: '$2a$12$hashedpassword',
    role: 'worker',
  });

  // Generate tokens
  adminToken = jwt.sign(
    { userId: adminUserId, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  workerToken = jwt.sign(
    { userId: (worker._id as mongoose.Types.ObjectId).toString(), role: 'worker' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
});

describe('GET /api/guides/search', () => {
  beforeEach(async () => {
    // Create guides with different statuses
    await CabinetGuide.create([
      {
        title: 'ATV630 VSD Cabinet Assembly',
        slug: 'atv630-vsd-cabinet-assembly',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Assembly guide for ATV630 variable speed drives',
        status: 'published',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date('2024-01-03'),
      },
      {
        title: 'MCC Section Wiring Guide',
        slug: 'mcc-section-wiring-guide',
        cabinet_type: 'MCC',
        drive_model: '',
        description: 'Motor control center wiring instructions',
        status: 'published',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date('2024-01-02'),
      },
      {
        title: 'Draft Control Panel Guide',
        slug: 'draft-control-panel-guide',
        cabinet_type: 'ControlPanel',
        drive_model: 'ATV320',
        description: 'Draft guide for control panels',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date('2024-01-01'),
      },
    ]);
  });

  it('should search guides by text query', async () => {
    const res = await request(app)
      .get('/api/guides/search?q=ATV630')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('ATV630 VSD Cabinet Assembly');
  });

  it('should filter by cabinetType', async () => {
    const res = await request(app)
      .get('/api/guides/search?cabinetType=MCC')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].cabinet_type).toBe('MCC');
  });

  it('should filter by driveModel', async () => {
    const res = await request(app)
      .get('/api/guides/search?driveModel=ATV630')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].drive_model).toBe('ATV630');
  });

  it('should return only published guides for workers', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ cabinetType: 'ControlPanel' })
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should return all matching guides for admins (including drafts)', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ cabinetType: 'ControlPanel' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('draft');
  });

  it('should return empty array when no matches', async () => {
    const res = await request(app)
      .get('/api/guides/search?q=nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should return all published guides when no query or filters for worker', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // Only published guides
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/guides/search?q=test');

    expect(res.status).toBe(401);
  });

  it('should filter by tags', async () => {
    const tag = await Tag.create({ name: 'vsd' });
    await CabinetGuide.updateOne(
      { slug: 'atv630-vsd-cabinet-assembly' },
      { $set: { tags: [tag._id] } }
    );

    const res = await request(app)
      .get(`/api/guides/search?tags=${(tag._id as mongoose.Types.ObjectId).toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('ATV630 VSD Cabinet Assembly');
  });
});
