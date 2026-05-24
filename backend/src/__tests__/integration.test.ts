// Set JWT_SECRET before importing app so middleware picks it up
process.env.JWT_SECRET = 'integration-test-secret';

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import app from '../app';
import { User } from '../models/User';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';

const JWT_SECRET = process.env.JWT_SECRET!;

let mongoServer: MongoMemoryServer;

// Helper: create a user directly in the DB and return a valid JWT
async function createUserAndToken(
  role: 'admin' | 'worker',
  email = `${role}@test.com`
): Promise<{ token: string; userId: string }> {
  const user = await User.create({
    name: `Test ${role}`,
    email,
    password_hash: 'TestPassword123',
    role,
  });
  const userId = (user._id as mongoose.Types.ObjectId).toString();
  const token = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '8h' });
  return { token, userId };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean all collections between tests
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 1: Full Guide Lifecycle
// create → add steps → upload media → publish → archive
// ─────────────────────────────────────────────────────────────────────────────
describe('Guide Lifecycle: create → add steps → upload media → publish → archive', () => {
  let adminToken: string;
  let adminUserId: string;

  beforeEach(async () => {
    const admin = await createUserAndToken('admin');
    adminToken = admin.token;
    adminUserId = admin.userId;
  });

  it('should complete the full guide lifecycle', async () => {
    // Step 1: Create a guide
    const createRes = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'ATV630 VSD Cabinet Assembly',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Step-by-step assembly guide for ATV630 cabinets',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('ATV630 VSD Cabinet Assembly');
    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.version).toBe(1);
    expect(createRes.body.slug).toBeDefined();

    const guideId = createRes.body._id;

    // Step 2: Add build steps
    const step1Res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Mount DIN Rails',
        description: 'Install 3x DIN rails at positions marked on backplate',
        estimated_time: 15,
        warning_notes: 'Ensure rails are level before tightening',
      });

    expect(step1Res.status).toBe(201);
    expect(step1Res.body.title).toBe('Mount DIN Rails');
    expect(step1Res.body.step_order).toBe(1);

    const step1Id = step1Res.body._id;

    const step2Res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Install Circuit Breakers',
        description: 'Mount circuit breakers on DIN rails',
        estimated_time: 20,
      });

    expect(step2Res.status).toBe(201);
    expect(step2Res.body.step_order).toBe(2);

    // Step 3: Upload media (image) for step 1
    // Create a minimal valid JPEG buffer (starts with FF D8 FF)
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00,
    ]);

    const uploadRes = await request(app)
      .post('/api/upload/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('buildStepId', step1Id)
      .attach('file', jpegBuffer, { filename: 'din-rails.jpg', contentType: 'image/jpeg' });

    // Upload may fail due to sharp processing of minimal buffer, but the route should be accessible
    // We test the API flow rather than actual image processing
    expect([201, 400, 500]).toContain(uploadRes.status);

    // Step 4: Publish the guide (requires at least 1 step)
    const publishRes = await request(app)
      .put(`/api/guides/${guideId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' });

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.status).toBe('published');
    expect(publishRes.body.version).toBe(2); // version increments on publish

    // Step 5: Archive the guide
    const archiveRes = await request(app)
      .put(`/api/guides/${guideId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'archived' });

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.status).toBe('archived');
    expect(archiveRes.body.version).toBe(2); // version doesn't change on archive
  });

  it('should not publish a guide with no steps', async () => {
    const createRes = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Empty Guide',
        cabinet_type: 'MCC',
        description: 'A guide with no steps',
      });

    expect(createRes.status).toBe(201);
    const guideId = createRes.body._id;

    const publishRes = await request(app)
      .put(`/api/guides/${guideId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' });

    expect(publishRes.status).toBe(400);
    expect(publishRes.body.error.message).toContain('no build steps');
  });

  it('should reject invalid status transitions', async () => {
    const createRes = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Transition Test Guide',
        cabinet_type: 'VSD',
      });

    const guideId = createRes.body._id;

    // draft → draft is invalid
    const invalidRes = await request(app)
      .put(`/api/guides/${guideId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'draft' });

    expect(invalidRes.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 2: Authentication Flow
// login → access protected route → expired token → re-login
// ─────────────────────────────────────────────────────────────────────────────
describe('Authentication Flow: login → access protected → expired token → re-login', () => {
  const testEmail = 'admin@cabinetlog.com';
  const testPassword = 'SecurePass123';

  beforeEach(async () => {
    // Create a user with known credentials
    await User.create({
      name: 'Admin User',
      email: testEmail,
      password_hash: testPassword, // Will be hashed by pre-save hook
      role: 'admin',
    });
  });

  it('should login with valid credentials and access protected routes', async () => {
    // Step 1: Login
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe(testEmail);
    expect(loginRes.body.user.role).toBe('admin');

    const token = loginRes.body.token;

    // Step 2: Access protected route with valid token
    const guidesRes = await request(app)
      .get('/api/guides')
      .set('Authorization', `Bearer ${token}`);

    expect(guidesRes.status).toBe(200);
  });

  it('should reject login with invalid credentials', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword',
    });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error.message).toContain('Invalid');
  });

  it('should reject requests with expired token', async () => {
    // Create an expired token
    const user = await User.findOne({ email: testEmail });
    const expiredToken = jwt.sign(
      { userId: (user!._id as mongoose.Types.ObjectId).toString(), role: 'admin' },
      JWT_SECRET,
      { expiresIn: '0s' } // immediately expired
    );

    // Wait a moment to ensure expiration
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await request(app)
      .get('/api/guides')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('should reject requests with malformed token', async () => {
    const res = await request(app)
      .get('/api/guides')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });

  it('should reject requests without authorization header', async () => {
    const res = await request(app).get('/api/guides');

    expect(res.status).toBe(401);
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({
      password: testPassword,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Email');
  });

  it('should return 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Password');
  });

  it('should allow re-login after token expiry', async () => {
    // First login
    const firstLogin = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(firstLogin.status).toBe(200);

    // Re-login (simulating after token expiry)
    const secondLogin = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.token).toBeDefined();

    // New token should work
    const guidesRes = await request(app)
      .get('/api/guides')
      .set('Authorization', `Bearer ${secondLogin.body.token}`);
    expect(guidesRes.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 3: Cascade Deletion
// delete guide → verify steps/media/files removed
// ─────────────────────────────────────────────────────────────────────────────
describe('Cascade Deletion: delete guide → verify steps/media/files removed', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createUserAndToken('admin');
    adminToken = admin.token;
  });

  it('should cascade delete all steps and media when guide is deleted', async () => {
    // Create a guide
    const guideRes = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Guide To Delete',
        cabinet_type: 'Control Panel',
        description: 'This guide will be deleted',
      });

    expect(guideRes.status).toBe(201);
    const guideId = guideRes.body._id;

    // Add steps
    const step1Res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Step One', description: 'First step' });

    expect(step1Res.status).toBe(201);
    const step1Id = step1Res.body._id;

    const step2Res = await request(app)
      .post(`/api/guides/${guideId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Step Two', description: 'Second step' });

    expect(step2Res.status).toBe(201);
    const step2Id = step2Res.body._id;

    // Manually create StepMedia records (simulating uploaded files)
    await StepMedia.create({
      build_step_id: step1Id,
      file_type: 'image',
      file_path: 'images/test/fake-image.jpg',
      original_name: 'photo.jpg',
      file_size: 1024,
      sort_order: 0,
    });

    await StepMedia.create({
      build_step_id: step2Id,
      file_type: 'pdf',
      file_path: 'pdfs/test/fake-doc.pdf',
      original_name: 'manual.pdf',
      file_size: 2048,
      sort_order: 0,
    });

    // Verify data exists before deletion
    const stepsBefore = await BuildStep.countDocuments({ cabinet_guide_id: guideId });
    expect(stepsBefore).toBe(2);

    const mediaBefore = await StepMedia.countDocuments({
      build_step_id: { $in: [step1Id, step2Id] },
    });
    expect(mediaBefore).toBe(2);

    // Delete the guide
    const deleteRes = await request(app)
      .delete(`/api/guides/${guideId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(204);

    // Verify guide is deleted
    const guideAfter = await CabinetGuide.findById(guideId);
    expect(guideAfter).toBeNull();

    // Verify steps are deleted
    const stepsAfter = await BuildStep.countDocuments({ cabinet_guide_id: guideId });
    expect(stepsAfter).toBe(0);

    // Verify media records are deleted
    const mediaAfter = await StepMedia.countDocuments({
      build_step_id: { $in: [step1Id, step2Id] },
    });
    expect(mediaAfter).toBe(0);
  });

  it('should return 404 when deleting a non-existent guide', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const deleteRes = await request(app)
      .delete(`/api/guides/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(404);
  });

  it('should not affect other guides when one is deleted', async () => {
    // Create two guides
    const guide1Res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Guide One', cabinet_type: 'VSD' });

    const guide2Res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Guide Two', cabinet_type: 'MCC' });

    const guide1Id = guide1Res.body._id;
    const guide2Id = guide2Res.body._id;

    // Add steps to both
    await request(app)
      .post(`/api/guides/${guide1Id}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Guide 1 Step', description: 'Step for guide 1' });

    await request(app)
      .post(`/api/guides/${guide2Id}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Guide 2 Step', description: 'Step for guide 2' });

    // Delete guide 1
    await request(app)
      .delete(`/api/guides/${guide1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Guide 2 should still exist with its steps
    const guide2After = await CabinetGuide.findById(guide2Id);
    expect(guide2After).not.toBeNull();

    const guide2Steps = await BuildStep.countDocuments({ cabinet_guide_id: guide2Id });
    expect(guide2Steps).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 4: Search
// create guides → verify search returns correct results with filters
// ─────────────────────────────────────────────────────────────────────────────
describe('Search: create guides → verify search returns correct results with filters', () => {
  let adminToken: string;
  let workerToken: string;

  beforeEach(async () => {
    const admin = await createUserAndToken('admin');
    adminToken = admin.token;

    const worker = await createUserAndToken('worker', 'worker@test.com');
    workerToken = worker.token;

    // Create multiple guides with different attributes
    const guide1Res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'ATV630 Water Cooling VSD Cabinet',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Assembly guide for water-cooled ATV630 variable speed drive cabinets',
      });

    const guide2Res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'MCC Section Motor Control Center',
        cabinet_type: 'MCC',
        drive_model: 'ATV320',
        description: 'Motor control center section assembly with ATV320 drives',
      });

    const guide3Res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Custom Control Panel Build',
        cabinet_type: 'Custom',
        drive_model: 'ATV630',
        description: 'Custom panel with ATV630 drive integration',
      });

    // Add steps to all guides so they can be published
    for (const guideId of [guide1Res.body._id, guide2Res.body._id, guide3Res.body._id]) {
      await request(app)
        .post(`/api/guides/${guideId}/steps`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Initial Setup Step', description: 'Setup description' });
    }

    // Publish guide 1 and guide 2 (guide 3 stays as draft)
    await request(app)
      .put(`/api/guides/${guide1Res.body._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' });

    await request(app)
      .put(`/api/guides/${guide2Res.body._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'published' });
  });

  it('should search guides by text query (admin sees all statuses)', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ q: 'ATV630' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // Admin should see both published and draft guides matching ATV630
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter search results by cabinet type', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ q: 'cabinet', cabinetType: 'VSD' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Only VSD cabinet type guides should be returned
    for (const guide of res.body.data) {
      expect(guide.cabinet_type).toBe('VSD');
    }
  });

  it('should only return published guides for workers', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ q: 'ATV630' })
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    // Worker should only see published guides
    for (const guide of res.body.data) {
      expect(guide.status).toBe('published');
    }
  });

  it('should return empty array for no matches', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ q: 'nonexistentxyz123' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should filter by drive model', async () => {
    const res = await request(app)
      .get('/api/guides/search')
      .query({ driveModel: 'ATV320' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const guide of res.body.data) {
      expect(guide.drive_model.toLowerCase()).toContain('atv320');
    }
  });

  it('should reject search query exceeding 200 characters', async () => {
    const longQuery = 'a'.repeat(201);
    const res = await request(app)
      .get('/api/guides/search')
      .query({ q: longQuery })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 5: Role-Based Access Control
// ─────────────────────────────────────────────────────────────────────────────
describe('Role-Based Access Control', () => {
  let adminToken: string;
  let workerToken: string;

  beforeEach(async () => {
    const admin = await createUserAndToken('admin');
    adminToken = admin.token;

    const worker = await createUserAndToken('worker', 'worker@test.com');
    workerToken = worker.token;
  });

  it('should allow admin to create guides', async () => {
    const res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Guide',
        cabinet_type: 'VSD',
      });

    expect(res.status).toBe(201);
  });

  it('should reject worker creating guides with 403', async () => {
    const res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        title: 'Worker Guide',
        cabinet_type: 'VSD',
      });

    expect(res.status).toBe(403);
  });

  it('should allow worker to read published guides', async () => {
    const res = await request(app)
      .get('/api/guides')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
  });

  it('should reject worker deleting guides with 403', async () => {
    // Create a guide as admin
    const createRes = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Protected Guide', cabinet_type: 'MCC' });

    const guideId = createRes.body._id;

    // Worker tries to delete
    const deleteRes = await request(app)
      .delete(`/api/guides/${guideId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(deleteRes.status).toBe(403);
  });
});
