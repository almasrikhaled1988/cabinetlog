import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { Tag } from '../models/Tag';
import { User } from '../models/User';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let workerToken: string;

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

  // Create worker user
  const worker = await User.create({
    name: 'Test Worker',
    email: 'worker@test.com',
    password_hash: '$2a$12$hashedpassword',
    role: 'worker',
  });

  // Generate tokens
  adminToken = jwt.sign(
    { userId: (admin._id as mongoose.Types.ObjectId).toString(), role: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  workerToken = jwt.sign(
    { userId: (worker._id as mongoose.Types.ObjectId).toString(), role: 'worker' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
});

describe('POST /api/tags', () => {
  it('should create a tag as admin', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'VSD' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('vsd'); // stored lowercase
  });

  it('should reject tag creation for workers', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'VSD' });

    expect(res.status).toBe(403);
  });

  it('should reject duplicate tag names (case-insensitive)', async () => {
    await Tag.create({ name: 'vsd' });

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'VSD' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.name).toContain('already exists');
  });

  it('should reject empty tag name', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  it('should reject tag name exceeding 50 characters', async () => {
    const longName = 'a'.repeat(51);
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: longName });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.name).toContain('between 1 and 50');
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .post('/api/tags')
      .send({ name: 'test' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/tags', () => {
  beforeEach(async () => {
    await Tag.create([
      { name: 'vsd' },
      { name: 'mcc' },
      { name: 'control-panel' },
    ]);
  });

  it('should list all tags sorted by name', async () => {
    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].name).toBe('control-panel');
    expect(res.body.data[1].name).toBe('mcc');
    expect(res.body.data[2].name).toBe('vsd');
  });

  it('should be accessible by workers', async () => {
    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/tags');

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/tags/:id', () => {
  it('should delete a tag as admin', async () => {
    const tag = await Tag.create({ name: 'to-delete' });
    const tagId = (tag._id as mongoose.Types.ObjectId).toString();

    const res = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify tag is deleted
    const found = await Tag.findById(tagId);
    expect(found).toBeNull();
  });

  it('should reject deletion for workers', async () => {
    const tag = await Tag.create({ name: 'protected' });
    const tagId = (tag._id as mongoose.Types.ObjectId).toString();

    const res = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent tag', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/api/tags/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('should require authentication', async () => {
    const tag = await Tag.create({ name: 'test' });
    const tagId = (tag._id as mongoose.Types.ObjectId).toString();

    const res = await request(app).delete(`/api/tags/${tagId}`);

    expect(res.status).toBe(401);
  });
});
