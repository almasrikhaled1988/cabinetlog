import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
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

describe('GET /api/guides', () => {
  describe('pagination', () => {
    beforeEach(async () => {
      // Create 25 published guides with staggered timestamps
      for (let i = 1; i <= 25; i++) {
        await CabinetGuide.create({
          title: `Guide ${i}`,
          slug: `guide-${i}`,
          cabinet_type: i % 2 === 0 ? 'VSD' : 'MCC',
          drive_model: `ATV${i}`,
          status: 'published',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date(Date.now() - (25 - i) * 1000), // Guide 25 is most recent
        });
      }
    });

    it('should return default page size of 20 sorted by updated_at descending', async () => {
      const res = await request(app)
        .get('/api/guides')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(20);
      expect(res.body.total).toBe(25);
      expect(res.body.page).toBe(1);
      expect(res.body.totalPages).toBe(2);

      // Verify sorted by updated_at descending
      for (let i = 0; i < res.body.data.length - 1; i++) {
        const current = new Date(res.body.data[i].updated_at).getTime();
        const next = new Date(res.body.data[i + 1].updated_at).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should accept page and limit query parameters', async () => {
      const res = await request(app)
        .get('/api/guides?page=2&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(10);
      expect(res.body.total).toBe(25);
      expect(res.body.page).toBe(2);
      expect(res.body.totalPages).toBe(3);
    });

    it('should return correct totalPages (ceil(total/limit))', async () => {
      const res = await request(app)
        .get('/api/guides?limit=7')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalPages).toBe(4); // ceil(25/7) = 4
    });

    it('should return empty data array when page exceeds total pages', async () => {
      const res = await request(app)
        .get('/api/guides?page=10&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(25);
      expect(res.body.totalPages).toBe(2);
    });

    it('should return validation error for page < 1', async () => {
      const res = await request(app)
        .get('/api/guides?page=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return validation error for limit > 100', async () => {
      const res = await request(app)
        .get('/api/guides?limit=101')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return validation error for limit < 1', async () => {
      const res = await request(app)
        .get('/api/guides?limit=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return validation error for non-integer page', async () => {
      const res = await request(app)
        .get('/api/guides?page=1.5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('worker role filtering', () => {
    beforeEach(async () => {
      // Create guides with different statuses
      await CabinetGuide.create({
        title: 'Published Guide',
        slug: 'published-guide',
        cabinet_type: 'VSD',
        status: 'published',
        version: 2,
        created_by: adminUserId,
        updated_at: new Date(),
      });
      await CabinetGuide.create({
        title: 'Draft Guide',
        slug: 'draft-guide',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });
      await CabinetGuide.create({
        title: 'Archived Guide',
        slug: 'archived-guide',
        cabinet_type: 'VSD',
        status: 'archived',
        version: 3,
        created_by: adminUserId,
        updated_at: new Date(),
      });
    });

    it('should return only published guides for workers', async () => {
      const res = await request(app)
        .get('/api/guides')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('published');
    });

    it('should return all guides for admins', async () => {
      const res = await request(app)
        .get('/api/guides')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
    });

    it('should allow admins to filter by status', async () => {
      const res = await request(app)
        .get('/api/guides?status=draft')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].status).toBe('draft');
    });

    it('should ignore status filter for workers (always published)', async () => {
      const res = await request(app)
        .get('/api/guides?status=draft')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      // Worker should still only see published, regardless of status param
      expect(res.body.data.every((g: any) => g.status === 'published')).toBe(true);
    });
  });

  describe('authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/guides');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/guides')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});


describe('DELETE /api/guides/:id', () => {
  it('should delete guide and cascade delete steps and media (204)', async () => {
    // Create a guide
    const guide = await CabinetGuide.create({
      title: 'Guide to Delete',
      slug: 'guide-to-delete',
      cabinet_type: 'VSD',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
      updated_at: new Date(),
    });
    const guideId = (guide._id as mongoose.Types.ObjectId).toString();

    // Create steps
    const step1 = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Step 1',
      description: 'First step',
      step_order: 1,
    });
    const step2 = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Step 2',
      description: 'Second step',
      step_order: 2,
    });

    // Create media records (files won't exist, but deletion handles gracefully)
    await StepMedia.create({
      build_step_id: step1._id,
      file_type: 'image',
      file_path: 'images/test1.jpg',
      original_name: 'test1.jpg',
      file_size: 1024,
      sort_order: 1,
    });
    await StepMedia.create({
      build_step_id: step2._id,
      file_type: 'pdf',
      file_path: 'pdfs/test2.pdf',
      original_name: 'test2.pdf',
      file_size: 2048,
      sort_order: 1,
    });

    const res = await request(app)
      .delete(`/api/guides/${guideId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify cascade deletion
    const deletedGuide = await CabinetGuide.findById(guideId);
    const remainingSteps = await BuildStep.find({ cabinet_guide_id: guideId });
    const remainingMedia = await StepMedia.find({
      build_step_id: { $in: [step1._id, step2._id] },
    });

    expect(deletedGuide).toBeNull();
    expect(remainingSteps).toHaveLength(0);
    expect(remainingMedia).toHaveLength(0);
  });

  it('should return 404 for non-existent guide', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/api/guides/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for worker role', async () => {
    const guide = await CabinetGuide.create({
      title: 'Worker Cannot Delete',
      slug: 'worker-cannot-delete',
      cabinet_type: 'VSD',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
      updated_at: new Date(),
    });
    const guideId = (guide._id as mongoose.Types.ObjectId).toString();

    const res = await request(app)
      .delete(`/api/guides/${guideId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(403);

    // Verify guide still exists
    const stillExists = await CabinetGuide.findById(guideId);
    expect(stillExists).not.toBeNull();
  });

  it('should return 401 without auth token', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app).delete(`/api/guides/${fakeId}`);

    expect(res.status).toBe(401);
  });
});
