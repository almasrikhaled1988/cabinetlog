import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from './User';
import { CabinetGuide } from './CabinetGuide';
import { BuildStep } from './BuildStep';
import { StepMedia } from './StepMedia';
import { Tag } from './Tag';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('User Model', () => {
  const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    password_hash: 'password123',
    role: 'admin' as const,
  };

  it('should create a user with valid data', async () => {
    const user = await User.create(validUser);
    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe('admin');
    expect(user.created_at).toBeInstanceOf(Date);
  });

  it('should hash the password on save', async () => {
    const user = await User.create(validUser);
    expect(user.password_hash).not.toBe('password123');
    expect(user.password_hash).toMatch(/^\$2[ab]\$/);
  });

  it('should compare passwords correctly', async () => {
    const user = await User.create(validUser);
    const isMatch = await user.comparePassword('password123');
    expect(isMatch).toBe(true);
    const isWrong = await user.comparePassword('wrongpassword');
    expect(isWrong).toBe(false);
  });

  it('should default role to worker', async () => {
    const user = await User.create({
      name: 'Worker',
      email: 'worker@example.com',
      password_hash: 'password123',
    });
    expect(user.role).toBe('worker');
  });

  it('should store email as lowercase', async () => {
    const user = await User.create({
      ...validUser,
      email: 'TEST@EXAMPLE.COM',
    });
    expect(user.email).toBe('test@example.com');
  });

  it('should reject invalid email format', async () => {
    await expect(
      User.create({ ...validUser, email: 'not-an-email' })
    ).rejects.toThrow();
  });

  it('should reject name shorter than 2 characters', async () => {
    await expect(
      User.create({ ...validUser, name: 'A' })
    ).rejects.toThrow();
  });

  it('should reject name longer than 100 characters', async () => {
    await expect(
      User.create({ ...validUser, name: 'A'.repeat(101) })
    ).rejects.toThrow();
  });

  it('should reject invalid role', async () => {
    await expect(
      User.create({ ...validUser, role: 'superadmin' })
    ).rejects.toThrow();
  });

  it('should enforce unique email (case-insensitive)', async () => {
    await User.create(validUser);
    await expect(
      User.create({ ...validUser, email: 'TEST@example.com' })
    ).rejects.toThrow();
  });
});

describe('CabinetGuide Model', () => {
  let userId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password_hash: 'password123',
      role: 'admin',
    });
    userId = user._id as mongoose.Types.ObjectId;
  });

  const getValidGuide = (userId: mongoose.Types.ObjectId) => ({
    title: 'ATV630 VSD Cabinet Assembly',
    slug: 'atv630-vsd-cabinet-assembly',
    cabinet_type: 'VSD',
    drive_model: 'ATV630',
    description: 'Step-by-step assembly guide',
    created_by: userId,
  });

  it('should create a guide with valid data', async () => {
    const guide = await CabinetGuide.create(getValidGuide(userId));
    expect(guide.title).toBe('ATV630 VSD Cabinet Assembly');
    expect(guide.slug).toBe('atv630-vsd-cabinet-assembly');
    expect(guide.status).toBe('draft');
    expect(guide.version).toBe(1);
  });

  it('should default status to draft', async () => {
    const guide = await CabinetGuide.create(getValidGuide(userId));
    expect(guide.status).toBe('draft');
  });

  it('should default version to 1', async () => {
    const guide = await CabinetGuide.create(getValidGuide(userId));
    expect(guide.version).toBe(1);
  });

  it('should reject title shorter than 3 characters', async () => {
    await expect(
      CabinetGuide.create({ ...getValidGuide(userId), title: 'AB' })
    ).rejects.toThrow();
  });

  it('should reject title longer than 200 characters', async () => {
    await expect(
      CabinetGuide.create({ ...getValidGuide(userId), title: 'A'.repeat(201) })
    ).rejects.toThrow();
  });

  it('should reject description longer than 5000 characters', async () => {
    await expect(
      CabinetGuide.create({ ...getValidGuide(userId), description: 'A'.repeat(5001) })
    ).rejects.toThrow();
  });

  it('should reject missing cabinet_type', async () => {
    const data = getValidGuide(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (data as any).cabinet_type;
    await expect(CabinetGuide.create(data)).rejects.toThrow();
  });

  it('should reject invalid status', async () => {
    await expect(
      CabinetGuide.create({ ...getValidGuide(userId), status: 'invalid' })
    ).rejects.toThrow();
  });

  it('should enforce unique slug', async () => {
    await CabinetGuide.create(getValidGuide(userId));
    await expect(
      CabinetGuide.create(getValidGuide(userId))
    ).rejects.toThrow();
  });

  it('should reject cabinet_type longer than 100 characters', async () => {
    await expect(
      CabinetGuide.create({ ...getValidGuide(userId), cabinet_type: 'A'.repeat(101) })
    ).rejects.toThrow();
  });
});

describe('BuildStep Model', () => {
  let guideId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password_hash: 'password123',
      role: 'admin',
    });
    const guide = await CabinetGuide.create({
      title: 'Test Guide',
      slug: 'test-guide',
      cabinet_type: 'VSD',
      created_by: user._id,
    });
    guideId = guide._id as mongoose.Types.ObjectId;
  });

  const getValidStep = (guideId: mongoose.Types.ObjectId) => ({
    cabinet_guide_id: guideId,
    title: 'Mount DIN Rails',
    description: 'Install DIN rails at marked positions',
    step_order: 1,
  });

  it('should create a step with valid data', async () => {
    const step = await BuildStep.create(getValidStep(guideId));
    expect(step.title).toBe('Mount DIN Rails');
    expect(step.step_order).toBe(1);
    expect(step.created_at).toBeInstanceOf(Date);
  });

  it('should reject title shorter than 3 characters', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), title: 'AB' })
    ).rejects.toThrow();
  });

  it('should reject title longer than 200 characters', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), title: 'A'.repeat(201) })
    ).rejects.toThrow();
  });

  it('should reject step_order of 0', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), step_order: 0 })
    ).rejects.toThrow();
  });

  it('should reject negative step_order', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), step_order: -1 })
    ).rejects.toThrow();
  });

  it('should reject non-integer step_order', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), step_order: 1.5 })
    ).rejects.toThrow();
  });

  it('should accept valid estimated_time', async () => {
    const step = await BuildStep.create({
      ...getValidStep(guideId),
      estimated_time: 15,
    });
    expect(step.estimated_time).toBe(15);
  });

  it('should reject estimated_time exceeding 10080', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), estimated_time: 10081 })
    ).rejects.toThrow();
  });

  it('should reject negative estimated_time', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), estimated_time: -5 })
    ).rejects.toThrow();
  });

  it('should reject warning_notes longer than 1000 characters', async () => {
    await expect(
      BuildStep.create({ ...getValidStep(guideId), warning_notes: 'A'.repeat(1001) })
    ).rejects.toThrow();
  });

  it('should enforce unique (cabinet_guide_id, step_order) compound index', async () => {
    await BuildStep.create(getValidStep(guideId));
    await expect(
      BuildStep.create(getValidStep(guideId))
    ).rejects.toThrow();
  });
});

describe('StepMedia Model', () => {
  let stepId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password_hash: 'password123',
      role: 'admin',
    });
    const guide = await CabinetGuide.create({
      title: 'Test Guide',
      slug: 'test-guide',
      cabinet_type: 'VSD',
      created_by: user._id,
    });
    const step = await BuildStep.create({
      cabinet_guide_id: guide._id,
      title: 'Test Step',
      description: 'Test',
      step_order: 1,
    });
    stepId = step._id as mongoose.Types.ObjectId;
  });

  const getValidMedia = (stepId: mongoose.Types.ObjectId) => ({
    build_step_id: stepId,
    file_type: 'image' as const,
    file_path: 'images/2024-01/abc123.jpg',
    original_name: 'photo.jpg',
    file_size: 1024000,
    sort_order: 1,
  });

  it('should create media with valid data', async () => {
    const media = await StepMedia.create(getValidMedia(stepId));
    expect(media.file_type).toBe('image');
    expect(media.file_path).toBe('images/2024-01/abc123.jpg');
    expect(media.sort_order).toBe(1);
  });

  it('should reject invalid file_type', async () => {
    await expect(
      StepMedia.create({ ...getValidMedia(stepId), file_type: 'video' })
    ).rejects.toThrow();
  });

  it('should reject missing build_step_id', async () => {
    const data = getValidMedia(stepId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (data as any).build_step_id;
    await expect(StepMedia.create(data)).rejects.toThrow();
  });

  it('should reject missing file_path', async () => {
    await expect(
      StepMedia.create({ ...getValidMedia(stepId), file_path: '' })
    ).rejects.toThrow();
  });

  it('should accept pdf file_type', async () => {
    const media = await StepMedia.create({
      ...getValidMedia(stepId),
      file_type: 'pdf',
      file_path: 'pdfs/2024-01/doc.pdf',
      original_name: 'manual.pdf',
    });
    expect(media.file_type).toBe('pdf');
  });

  it('should default sort_order to 0', async () => {
    const data = getValidMedia(stepId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (data as any).sort_order;
    const media = await StepMedia.create(data);
    expect(media.sort_order).toBe(0);
  });
});

describe('Tag Model', () => {
  it('should create a tag with valid data', async () => {
    const tag = await Tag.create({ name: 'VSD' });
    expect(tag.name).toBe('vsd'); // stored lowercase
    expect(tag.created_at).toBeInstanceOf(Date);
  });

  it('should store name as lowercase', async () => {
    const tag = await Tag.create({ name: 'Water-Cooling' });
    expect(tag.name).toBe('water-cooling');
  });

  it('should reject empty name', async () => {
    await expect(Tag.create({ name: '' })).rejects.toThrow();
  });

  it('should reject name longer than 50 characters', async () => {
    await expect(Tag.create({ name: 'A'.repeat(51) })).rejects.toThrow();
  });

  it('should enforce unique name (case-insensitive)', async () => {
    await Tag.create({ name: 'vsd' });
    await expect(Tag.create({ name: 'VSD' })).rejects.toThrow();
  });
});
