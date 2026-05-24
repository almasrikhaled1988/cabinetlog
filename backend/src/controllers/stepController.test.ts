import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { User } from '../models/User';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let workerToken: string;
let adminUserId: string;
let guideId: string;

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

  // Create a guide for step tests
  const guide = await CabinetGuide.create({
    title: 'Test Guide',
    slug: 'test-guide',
    cabinet_type: 'VSD',
    status: 'draft',
    version: 1,
    created_by: adminUserId,
    updated_at: new Date(),
  });
  guideId = (guide._id as mongoose.Types.ObjectId).toString();
});

describe('POST /api/guides/:guideId/steps', () => {
  it('should create a step with auto-assigned step_order (admin)', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Mount DIN Rails', description: 'Install rails' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Mount DIN Rails');
    expect(res.body.step_order).toBe(1);
    expect(res.body.cabinet_guide_id).toBe(guideId);
  });

  it('should auto-increment step_order for subsequent steps', async () => {
    await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Step One' });

    const res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Step Two' });

    expect(res.status).toBe(201);
    expect(res.body.step_order).toBe(2);
  });

  it('should return 403 for worker role', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ title: 'Mount DIN Rails' });

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .send({ title: 'Mount DIN Rails' });

    expect(res.status).toBe(401);
  });

  it('should return 400 for title shorter than 3 characters', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'AB' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing title', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'No title provided' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/steps/:id', () => {
  let stepId: string;

  beforeEach(async () => {
    const step = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Original Title',
      description: 'Original description',
      step_order: 1,
      created_at: new Date(),
    });
    stepId = (step._id as mongoose.Types.ObjectId).toString();
  });

  it('should update step title (admin)', async () => {
    const res = await request(app)
      .put(`/api/steps/${stepId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('should update step description', async () => {
    const res = await request(app)
      .put(`/api/steps/${stepId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'New description' });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('New description');
  });

  it('should return 403 for worker role', async () => {
    const res = await request(app)
      .put(`/api/steps/${stepId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent step', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/steps/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid title length', async () => {
    const res = await request(app)
      .put(`/api/steps/${stepId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'AB' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/steps/:id', () => {
  let stepId: string;

  beforeEach(async () => {
    const step = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Step to Delete',
      description: 'Will be deleted',
      step_order: 1,
      created_at: new Date(),
    });
    stepId = (step._id as mongoose.Types.ObjectId).toString();
  });

  it('should delete a step (admin)', async () => {
    const res = await request(app)
      .delete(`/api/steps/${stepId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify step is gone
    const step = await BuildStep.findById(stepId);
    expect(step).toBeNull();
  });

  it('should reassign step_order after deletion', async () => {
    // Create additional steps
    const step2 = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Step Two',
      description: '',
      step_order: 2,
      created_at: new Date(),
    });
    await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Step Three',
      description: '',
      step_order: 3,
      created_at: new Date(),
    });

    // Delete step 2
    await request(app)
      .delete(`/api/steps/${(step2._id as mongoose.Types.ObjectId).toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Remaining steps should be reordered 1, 2
    const remaining = await BuildStep.find({ cabinet_guide_id: guideId }).sort({ step_order: 1 });
    expect(remaining).toHaveLength(2);
    expect(remaining[0].step_order).toBe(1);
    expect(remaining[1].step_order).toBe(2);
  });

  it('should return 403 for worker role', async () => {
    const res = await request(app)
      .delete(`/api/steps/${stepId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent step', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .delete(`/api/steps/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/guides/:guideId/steps/reorder', () => {
  let stepIds: string[];

  beforeEach(async () => {
    stepIds = [];
    for (let i = 1; i <= 3; i++) {
      const step = await BuildStep.create({
        cabinet_guide_id: guideId,
        title: `Step ${i}`,
        description: '',
        step_order: i,
        created_at: new Date(),
      });
      stepIds.push((step._id as mongoose.Types.ObjectId).toString());
    }
  });

  it('should reorder steps (admin)', async () => {
    const reversed = [...stepIds].reverse();
    const res = await request(app)
      .put(`/api/guides/${guideId}/steps/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stepIds: reversed });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]._id).toBe(reversed[0]);
    expect(res.body[0].step_order).toBe(1);
    expect(res.body[1]._id).toBe(reversed[1]);
    expect(res.body[1].step_order).toBe(2);
    expect(res.body[2]._id).toBe(reversed[2]);
    expect(res.body[2].step_order).toBe(3);
  });

  it('should return 403 for worker role', async () => {
    const res = await request(app)
      .put(`/api/guides/${guideId}/steps/reorder`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ stepIds });

    expect(res.status).toBe(403);
  });

  it('should return 400 for duplicate step IDs', async () => {
    const res = await request(app)
      .put(`/api/guides/${guideId}/steps/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stepIds: [stepIds[0], stepIds[0], stepIds[2]] });

    expect(res.status).toBe(400);
  });

  it('should return 400 for step IDs not belonging to guide', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/guides/${guideId}/steps/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stepIds: [stepIds[0], stepIds[1], fakeId] });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/guides/:guideId/steps', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 3; i++) {
      await BuildStep.create({
        cabinet_guide_id: guideId,
        title: `Step ${i}`,
        description: `Description ${i}`,
        step_order: i,
        created_at: new Date(),
      });
    }
  });

  it('should return steps sorted by step_order', async () => {
    const res = await request(app)
      .get(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].step_order).toBe(1);
    expect(res.body[1].step_order).toBe(2);
    expect(res.body[2].step_order).toBe(3);
  });

  it('should return empty array for guide with no steps', async () => {
    const emptyGuide = await CabinetGuide.create({
      title: 'Empty Guide',
      slug: 'empty-guide',
      cabinet_type: 'MCC',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
      updated_at: new Date(),
    });

    const res = await request(app)
      .get(`/api/guides/${(emptyGuide._id as mongoose.Types.ObjectId).toString()}/steps`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('should be accessible by workers (read-only)', async () => {
    const res = await request(app)
      .get(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .get(`/api/guides/${guideId}/steps`);

    expect(res.status).toBe(401);
  });
});
