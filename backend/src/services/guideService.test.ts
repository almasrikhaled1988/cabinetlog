import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { User } from '../models/User';
import '../models/Tag'; // Register Tag model for populate
import { guideService, generateBaseSlug, generateUniqueSlug, validateGuideFields } from './guideService';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';

let mongoServer: MongoMemoryServer;
let adminUserId: string;

beforeAll(async () => {
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

  // Create a test admin user
  const admin = await User.create({
    name: 'Test Admin',
    email: 'admin@test.com',
    password_hash: '$2a$12$hashedpassword',
    role: 'admin',
  });
  adminUserId = (admin._id as mongoose.Types.ObjectId).toString();
});

describe('generateBaseSlug', () => {
  it('should convert title to lowercase with hyphens', () => {
    expect(generateBaseSlug('ATV630 VSD Cabinet Assembly')).toBe('atv630-vsd-cabinet-assembly');
  });

  it('should remove special characters', () => {
    expect(generateBaseSlug('Guide (v2) — Special!')).toBe('guide-v2-special');
  });

  it('should collapse multiple hyphens', () => {
    expect(generateBaseSlug('hello---world')).toBe('hello-world');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(generateBaseSlug('-hello world-')).toBe('hello-world');
  });

  it('should truncate to 200 characters', () => {
    const longTitle = 'a'.repeat(250);
    const slug = generateBaseSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(200);
  });

  it('should return "guide" for empty/special-only input', () => {
    expect(generateBaseSlug('!!!')).toBe('guide');
  });
});

describe('generateUniqueSlug', () => {
  it('should return base slug when no duplicates exist', async () => {
    const slug = await generateUniqueSlug('My Test Guide');
    expect(slug).toBe('my-test-guide');
  });

  it('should append -2 when base slug exists', async () => {
    await CabinetGuide.create({
      title: 'My Test Guide',
      slug: 'my-test-guide',
      cabinet_type: 'VSD',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
    });

    const slug = await generateUniqueSlug('My Test Guide');
    expect(slug).toBe('my-test-guide-2');
  });

  it('should append -3 when -2 also exists', async () => {
    await CabinetGuide.create({
      title: 'My Test Guide',
      slug: 'my-test-guide',
      cabinet_type: 'VSD',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
    });
    await CabinetGuide.create({
      title: 'My Test Guide 2',
      slug: 'my-test-guide-2',
      cabinet_type: 'VSD',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
    });

    const slug = await generateUniqueSlug('My Test Guide');
    expect(slug).toBe('my-test-guide-3');
  });
});

describe('validateGuideFields', () => {
  it('should return errors for missing required fields on create', () => {
    const errors = validateGuideFields({}, true);
    expect(errors.title).toBeDefined();
    expect(errors.cabinet_type).toBeDefined();
  });

  it('should return error for title shorter than 3 chars', () => {
    const errors = validateGuideFields({ title: 'ab' }, false);
    expect(errors.title).toBeDefined();
  });

  it('should return error for title longer than 200 chars', () => {
    const errors = validateGuideFields({ title: 'a'.repeat(201) }, false);
    expect(errors.title).toBeDefined();
  });

  it('should return error for description longer than 5000 chars', () => {
    const errors = validateGuideFields({ description: 'a'.repeat(5001) }, false);
    expect(errors.description).toBeDefined();
  });

  it('should return error for cabinet_type longer than 100 chars', () => {
    const errors = validateGuideFields({ cabinet_type: 'a'.repeat(101) }, false);
    expect(errors.cabinet_type).toBeDefined();
  });

  it('should return no errors for valid data', () => {
    const errors = validateGuideFields(
      { title: 'Valid Title', cabinet_type: 'VSD', description: 'A description' },
      true
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('guideService.createGuide', () => {
  const validGuideData = {
    title: 'ATV630 VSD Cabinet Assembly',
    cabinet_type: 'VSD',
    drive_model: 'ATV630',
    description: 'Step-by-step assembly guide',
  };

  it('should create a guide with status draft and version 1', async () => {
    const guide = await guideService.createGuide(validGuideData, adminUserId);

    expect(guide.title).toBe('ATV630 VSD Cabinet Assembly');
    expect(guide.status).toBe('draft');
    expect(guide.version).toBe(1);
    expect(guide.slug).toBe('atv630-vsd-cabinet-assembly');
    expect(guide.created_by.toString()).toBe(adminUserId);
  });

  it('should set created_at and updated_at timestamps', async () => {
    const before = new Date();
    const guide = await guideService.createGuide(validGuideData, adminUserId);
    const after = new Date();

    expect(guide.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(guide.created_at.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(guide.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(guide.updated_at.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should generate unique slug for duplicate titles', async () => {
    const guide1 = await guideService.createGuide(validGuideData, adminUserId);
    const guide2 = await guideService.createGuide(validGuideData, adminUserId);

    expect(guide1.slug).toBe('atv630-vsd-cabinet-assembly');
    expect(guide2.slug).toBe('atv630-vsd-cabinet-assembly-2');
  });

  it('should throw ValidationError for title shorter than 3 chars', async () => {
    await expect(
      guideService.createGuide({ ...validGuideData, title: 'ab' }, adminUserId)
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for missing cabinet_type', async () => {
    await expect(
      guideService.createGuide(
        { ...validGuideData, cabinet_type: '' } as any,
        adminUserId
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for description exceeding 5000 chars', async () => {
    await expect(
      guideService.createGuide(
        { ...validGuideData, description: 'a'.repeat(5001) },
        adminUserId
      )
    ).rejects.toThrow(ValidationError);
  });
});

describe('guideService.getGuides', () => {
  beforeEach(async () => {
    // Create multiple guides
    for (let i = 1; i <= 25; i++) {
      await CabinetGuide.create({
        title: `Guide ${i}`,
        slug: `guide-${i}`,
        cabinet_type: i % 2 === 0 ? 'VSD' : 'MCC',
        status: i <= 20 ? 'published' : 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(Date.now() - i * 1000), // stagger timestamps
      });
    }
  });

  it('should return paginated results with default page size 20', async () => {
    const result = await guideService.getGuides({});

    expect(result.data.length).toBe(20);
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2);
  });

  it('should filter by status', async () => {
    const result = await guideService.getGuides({ status: 'draft' });

    expect(result.total).toBe(5);
    result.data.forEach((guide: any) => {
      expect(guide.status).toBe('draft');
    });
  });

  it('should filter by cabinet type', async () => {
    const result = await guideService.getGuides({ cabinetType: 'VSD' });

    result.data.forEach((guide: any) => {
      expect(guide.cabinet_type).toBe('VSD');
    });
  });

  it('should return empty data for page exceeding total', async () => {
    const result = await guideService.getGuides({ page: 10, limit: 20 });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(2);
  });

  it('should throw ValidationError for invalid page', async () => {
    await expect(guideService.getGuides({ page: 0 })).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for limit > 100', async () => {
    await expect(guideService.getGuides({ limit: 101 })).rejects.toThrow(ValidationError);
  });
});

describe('guideService.getGuideById', () => {
  it('should return guide by ID', async () => {
    const created = await guideService.createGuide(
      {
        title: 'Test Guide',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Test',
      },
      adminUserId
    );

    const guide = await guideService.getGuideById((created._id as mongoose.Types.ObjectId).toString());
    expect(guide.title).toBe('Test Guide');
  });

  it('should throw NotFoundError for non-existent ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(guideService.getGuideById(fakeId)).rejects.toThrow(NotFoundError);
  });
});

describe('guideService.updateGuide', () => {
  let guideId: string;

  beforeEach(async () => {
    const guide = await guideService.createGuide(
      {
        title: 'Original Title',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Original description',
      },
      adminUserId
    );
    guideId = (guide._id as mongoose.Types.ObjectId).toString();
  });

  it('should update title and regenerate slug', async () => {
    const updated = await guideService.updateGuide(guideId, { title: 'New Title Here' });

    expect(updated.title).toBe('New Title Here');
    expect(updated.slug).toBe('new-title-here');
  });

  it('should update updated_at timestamp', async () => {
    const before = await guideService.getGuideById(guideId);
    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = await guideService.updateGuide(guideId, { description: 'Updated' });

    expect(updated.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });

  it('should throw NotFoundError for non-existent guide', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      guideService.updateGuide(fakeId, { title: 'New Title' })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError for invalid title', async () => {
    await expect(
      guideService.updateGuide(guideId, { title: 'ab' })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for description exceeding 5000 chars', async () => {
    await expect(
      guideService.updateGuide(guideId, { description: 'a'.repeat(5001) })
    ).rejects.toThrow(ValidationError);
  });
});

describe('guideService.deleteGuide', () => {
  it('should delete guide and associated steps and media', async () => {
    const guide = await guideService.createGuide(
      {
        title: 'Guide to Delete',
        cabinet_type: 'VSD',
        drive_model: 'ATV630',
        description: 'Will be deleted',
      },
      adminUserId
    );
    const guideId = (guide._id as mongoose.Types.ObjectId).toString();

    // Create a step
    const step = await BuildStep.create({
      cabinet_guide_id: guideId,
      title: 'Step 1',
      description: 'First step',
      step_order: 1,
    });

    // Create media (file won't exist, but deletion should handle gracefully)
    await StepMedia.create({
      build_step_id: step._id,
      file_type: 'image',
      file_path: 'images/nonexistent.jpg',
      original_name: 'test.jpg',
      file_size: 1024,
      sort_order: 1,
    });

    await guideService.deleteGuide(guideId);

    // Verify everything is deleted
    const deletedGuide = await CabinetGuide.findById(guideId);
    const remainingSteps = await BuildStep.find({ cabinet_guide_id: guideId });
    const remainingMedia = await StepMedia.find({ build_step_id: step._id });

    expect(deletedGuide).toBeNull();
    expect(remainingSteps).toHaveLength(0);
    expect(remainingMedia).toHaveLength(0);
  });

  it('should throw NotFoundError for non-existent guide', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(guideService.deleteGuide(fakeId)).rejects.toThrow(NotFoundError);
  });
});

import { transitionGuideStatus } from './guideService';

describe('transitionGuideStatus', () => {
  describe('valid transitions', () => {
    it('should transition from draft to published when steps exist', async () => {
      const guide = await CabinetGuide.create({
        title: 'Publish Test',
        slug: 'publish-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });
      await BuildStep.create({
        cabinet_guide_id: guide._id,
        title: 'Step 1',
        description: 'First step',
        step_order: 1,
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'published'
      );

      expect(result.status).toBe('published');
      expect(result.version).toBe(2);
    });

    it('should transition from draft to archived', async () => {
      const guide = await CabinetGuide.create({
        title: 'Archive Draft Test',
        slug: 'archive-draft-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'archived'
      );

      expect(result.status).toBe('archived');
      expect(result.version).toBe(1); // version unchanged
    });

    it('should transition from published to archived', async () => {
      const guide = await CabinetGuide.create({
        title: 'Archive Published Test',
        slug: 'archive-published-test',
        cabinet_type: 'VSD',
        status: 'published',
        version: 2,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'archived'
      );

      expect(result.status).toBe('archived');
      expect(result.version).toBe(2); // version unchanged
    });

    it('should transition from archived to draft', async () => {
      const guide = await CabinetGuide.create({
        title: 'Reopen Test',
        slug: 'reopen-test',
        cabinet_type: 'VSD',
        status: 'archived',
        version: 3,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'draft'
      );

      expect(result.status).toBe('draft');
      expect(result.version).toBe(3); // version unchanged
    });
  });

  describe('invalid transitions', () => {
    it('should reject published to draft', async () => {
      const guide = await CabinetGuide.create({
        title: 'Invalid Transition Test',
        slug: 'invalid-transition-test',
        cabinet_type: 'VSD',
        status: 'published',
        version: 2,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'draft'
        )
      ).rejects.toThrow(ValidationError);

      // Verify guide is unchanged
      const unchanged = await CabinetGuide.findById(guide._id);
      expect(unchanged!.status).toBe('published');
      expect(unchanged!.version).toBe(2);
    });

    it('should reject published to published', async () => {
      const guide = await CabinetGuide.create({
        title: 'Self Transition Test',
        slug: 'self-transition-test',
        cabinet_type: 'VSD',
        status: 'published',
        version: 2,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'published'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject archived to published', async () => {
      const guide = await CabinetGuide.create({
        title: 'Archived to Published Test',
        slug: 'archived-to-published-test',
        cabinet_type: 'VSD',
        status: 'archived',
        version: 2,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'published'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject archived to archived', async () => {
      const guide = await CabinetGuide.create({
        title: 'Archived Self Test',
        slug: 'archived-self-test',
        cabinet_type: 'VSD',
        status: 'archived',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'archived'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject draft to draft', async () => {
      const guide = await CabinetGuide.create({
        title: 'Draft Self Test',
        slug: 'draft-self-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'draft'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid target status', async () => {
      const guide = await CabinetGuide.create({
        title: 'Invalid Status Test',
        slug: 'invalid-status-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'invalid'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should leave guide unchanged on invalid transition', async () => {
      const originalDate = new Date('2020-01-01');
      const guide = await CabinetGuide.create({
        title: 'Unchanged Test',
        slug: 'unchanged-test',
        cabinet_type: 'VSD',
        status: 'archived',
        version: 5,
        created_by: adminUserId,
        updated_at: originalDate,
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'published'
        )
      ).rejects.toThrow(ValidationError);

      const unchanged = await CabinetGuide.findById(guide._id);
      expect(unchanged!.status).toBe('archived');
      expect(unchanged!.version).toBe(5);
      expect(unchanged!.updated_at.getTime()).toBe(originalDate.getTime());
    });
  });

  describe('publish preconditions', () => {
    it('should reject publish when guide has no build steps', async () => {
      const guide = await CabinetGuide.create({
        title: 'No Steps Test',
        slug: 'no-steps-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      await expect(
        transitionGuideStatus(
          (guide._id as mongoose.Types.ObjectId).toString(),
          'published'
        )
      ).rejects.toThrow(ValidationError);

      // Verify guide is unchanged
      const unchanged = await CabinetGuide.findById(guide._id);
      expect(unchanged!.status).toBe('draft');
      expect(unchanged!.version).toBe(1);
    });

    it('should increment version by exactly 1 on publish', async () => {
      const guide = await CabinetGuide.create({
        title: 'Version Increment Test',
        slug: 'version-increment-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 5,
        created_by: adminUserId,
        updated_at: new Date(),
      });
      await BuildStep.create({
        cabinet_guide_id: guide._id,
        title: 'Step 1',
        description: 'First step',
        step_order: 1,
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'published'
      );

      expect(result.version).toBe(6);
    });
  });

  describe('version monotonicity', () => {
    it('should not decrease version on archive', async () => {
      const guide = await CabinetGuide.create({
        title: 'Version Archive Test',
        slug: 'version-archive-test',
        cabinet_type: 'VSD',
        status: 'published',
        version: 3,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'archived'
      );

      expect(result.version).toBe(3);
    });

    it('should not decrease version on re-open (archived to draft)', async () => {
      const guide = await CabinetGuide.create({
        title: 'Version Reopen Test',
        slug: 'version-reopen-test',
        cabinet_type: 'VSD',
        status: 'archived',
        version: 4,
        created_by: adminUserId,
        updated_at: new Date(),
      });

      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'draft'
      );

      expect(result.version).toBe(4);
    });

    it('should increment version on re-publish cycle', async () => {
      const guide = await CabinetGuide.create({
        title: 'Republish Cycle Test',
        slug: 'republish-cycle-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date(),
      });
      await BuildStep.create({
        cabinet_guide_id: guide._id,
        title: 'Step 1',
        description: 'First step',
        step_order: 1,
      });

      const guideId = (guide._id as mongoose.Types.ObjectId).toString();

      // Publish: version 1 → 2
      const published = await transitionGuideStatus(guideId, 'published');
      expect(published.version).toBe(2);

      // Archive: version stays 2
      const archived = await transitionGuideStatus(guideId, 'archived');
      expect(archived.version).toBe(2);

      // Re-open to draft: version stays 2
      const reopened = await transitionGuideStatus(guideId, 'draft');
      expect(reopened.version).toBe(2);

      // Re-publish: version 2 → 3
      const republished = await transitionGuideStatus(guideId, 'published');
      expect(republished.version).toBe(3);
    });
  });

  describe('updated_at', () => {
    it('should update updated_at on every status change', async () => {
      const guide = await CabinetGuide.create({
        title: 'Timestamp Test',
        slug: 'timestamp-test',
        cabinet_type: 'VSD',
        status: 'draft',
        version: 1,
        created_by: adminUserId,
        updated_at: new Date('2020-01-01'),
      });
      await BuildStep.create({
        cabinet_guide_id: guide._id,
        title: 'Step 1',
        description: 'First step',
        step_order: 1,
      });

      const before = new Date();
      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'published'
      );
      const after = new Date();

      expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.updated_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should update updated_at on archive transition', async () => {
      const guide = await CabinetGuide.create({
        title: 'Archive Timestamp Test',
        slug: 'archive-timestamp-test',
        cabinet_type: 'VSD',
        status: 'published',
        version: 2,
        created_by: adminUserId,
        updated_at: new Date('2020-01-01'),
      });

      const before = new Date();
      const result = await transitionGuideStatus(
        (guide._id as mongoose.Types.ObjectId).toString(),
        'archived'
      );

      expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('not found', () => {
    it('should throw NotFoundError for non-existent guide', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      await expect(
        transitionGuideStatus(fakeId, 'published')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
