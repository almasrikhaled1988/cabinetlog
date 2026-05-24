import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import jwt from 'jsonwebtoken';
import { StepMedia } from '../models/StepMedia';
import { BuildStep } from '../models/BuildStep';
import { CabinetGuide } from '../models/CabinetGuide';
import { User } from '../models/User';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let workerToken: string;
let buildStepId: string;

const JWT_SECRET = 'test-secret';

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Create admin user
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@test.com',
    password_hash: '$2a$12$dummy',
    role: 'admin',
  });

  // Create worker user
  const worker = await User.create({
    name: 'Worker User',
    email: 'worker@test.com',
    password_hash: '$2a$12$dummy',
    role: 'worker',
  });

  const adminId = (admin._id as mongoose.Types.ObjectId).toString();
  const workerId = (worker._id as mongoose.Types.ObjectId).toString();

  adminToken = jwt.sign({ userId: adminId, role: 'admin' }, JWT_SECRET, {
    expiresIn: '8h',
  });
  workerToken = jwt.sign({ userId: workerId, role: 'worker' }, JWT_SECRET, {
    expiresIn: '8h',
  });

  // Create a guide and step for upload tests
  const guide = await CabinetGuide.create({
    title: 'Test Guide',
    slug: 'test-guide',
    cabinet_type: 'VSD',
    drive_model: 'ATV630',
    description: 'Test guide for uploads',
    status: 'draft',
    version: 1,
    created_by: admin._id,
  });

  const step = await BuildStep.create({
    cabinet_guide_id: guide._id,
    title: 'Test Step',
    description: 'A test step',
    step_order: 1,
  });

  buildStepId = (step._id as mongoose.Types.ObjectId).toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Upload Controller', () => {
  describe('POST /api/upload/image', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/upload/image').send();
      expect(res.status).toBe(401);
    });

    it('should return 403 for worker role', async () => {
      const res = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${workerToken}`)
        .send();
      expect(res.status).toBe(403);
    });

    it('should return 400 when no file is provided', async () => {
      const res = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('buildStepId', buildStepId);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No file provided');
    });

    it('should return 400 when buildStepId is missing', async () => {
      // Create a minimal valid JPEG buffer (magic bytes)
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      ]);

      const res = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('buildStepId is required');
    });
  });

  describe('POST /api/upload/pdf', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/upload/pdf').send();
      expect(res.status).toBe(401);
    });

    it('should return 403 for worker role', async () => {
      const res = await request(app)
        .post('/api/upload/pdf')
        .set('Authorization', `Bearer ${workerToken}`)
        .send();
      expect(res.status).toBe(403);
    });

    it('should return 400 when no file is provided', async () => {
      const res = await request(app)
        .post('/api/upload/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('buildStepId', buildStepId);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No file provided');
    });

    it('should return 400 when buildStepId is missing', async () => {
      // Create a minimal valid PDF buffer (magic bytes)
      const pdfBuffer = Buffer.from('%PDF-1.4 minimal content');

      const res = await request(app)
        .post('/api/upload/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdfBuffer, { filename: 'test.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('buildStepId is required');
    });
  });

  describe('DELETE /api/upload/:id', () => {
    it('should return 401 without auth token', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/upload/${fakeId}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 for worker role', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/upload/${fakeId}`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when media does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/upload/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Media file not found');
    });

    it('should delete an existing media record and return 204', async () => {
      // Create a media record directly in the database
      const media = await StepMedia.create({
        build_step_id: buildStepId,
        file_type: 'image',
        file_path: 'images/2024/01/01/test-uuid.jpg',
        original_name: 'photo.jpg',
        file_size: 1024,
        sort_order: 0,
      });

      const mediaId = (media._id as mongoose.Types.ObjectId).toString();

      const res = await request(app)
        .delete(`/api/upload/${mediaId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify record is deleted
      const found = await StepMedia.findById(mediaId);
      expect(found).toBeNull();
    });
  });
});
