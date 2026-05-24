import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CabinetGuide } from '../models/CabinetGuide';
import { User } from '../models/User';
import { Tag } from '../models/Tag';
import '../models/Tag'; // Register Tag model for populate
import { searchService } from './searchService';
import { ValidationError } from '../middleware/errorHandler';

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

  // Ensure text index exists after collection clear
  await CabinetGuide.ensureIndexes();

  // Create a test admin user
  const admin = await User.create({
    name: 'Test Admin',
    email: 'admin@test.com',
    password_hash: '$2a$12$hashedpassword',
    role: 'admin',
  });
  adminUserId = (admin._id as mongoose.Types.ObjectId).toString();
});

describe('searchService.searchGuides', () => {
  describe('query validation', () => {
    it('should throw ValidationError for query longer than 200 characters', async () => {
      const longQuery = 'a'.repeat(201);
      await expect(
        searchService.searchGuides(longQuery, {}, 'worker')
      ).rejects.toThrow(ValidationError);
    });

    it('should accept query of exactly 1 character', async () => {
      const results = await searchService.searchGuides('a', {}, 'worker');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should accept query of exactly 200 characters', async () => {
      const query = 'a'.repeat(200);
      const results = await searchService.searchGuides(query, {}, 'worker');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should allow undefined query (filter-only)', async () => {
      const results = await searchService.searchGuides(undefined, {}, 'worker');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should allow empty string query (filter-only)', async () => {
      const results = await searchService.searchGuides('', {}, 'worker');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('text search', () => {
    beforeEach(async () => {
      await CabinetGuide.create([
        {
          title: 'ATV630 VSD Cabinet Assembly',
          slug: 'atv630-vsd-cabinet-assembly',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'Assembly guide for variable speed drive cabinets',
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
          title: 'Control Panel Setup',
          slug: 'control-panel-setup',
          cabinet_type: 'Control Panel',
          drive_model: 'ATV320',
          description: 'Basic control panel assembly',
          status: 'published',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date('2024-01-01'),
        },
        {
          title: 'Draft VSD Guide',
          slug: 'draft-vsd-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'This is a draft guide for VSD cabinets',
          status: 'draft',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date('2024-01-04'),
        },
      ]);
    });

    it('should find guides matching text query in title', async () => {
      const results = await searchService.searchGuides('ATV630', {}, 'admin');
      expect(results.length).toBeGreaterThan(0);
      const titles = results.map((r) => r.title);
      expect(titles).toContain('ATV630 VSD Cabinet Assembly');
    });

    it('should find guides matching text query in description', async () => {
      const results = await searchService.searchGuides('wiring', {}, 'admin');
      expect(results.length).toBeGreaterThan(0);
      const titles = results.map((r) => r.title);
      expect(titles).toContain('MCC Section Wiring Guide');
    });

    it('should find guides matching text query in cabinet_type', async () => {
      const results = await searchService.searchGuides('MCC', {}, 'admin');
      expect(results.length).toBeGreaterThan(0);
      const titles = results.map((r) => r.title);
      expect(titles).toContain('MCC Section Wiring Guide');
    });

    it('should return empty array for no matches', async () => {
      const results = await searchService.searchGuides('nonexistent-xyz-123', {}, 'worker');
      expect(results).toEqual([]);
    });
  });

  describe('worker role filtering', () => {
    beforeEach(async () => {
      await CabinetGuide.create([
        {
          title: 'Published Guide',
          slug: 'published-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'A published guide',
          status: 'published',
          version: 2,
          created_by: adminUserId,
          updated_at: new Date('2024-01-02'),
        },
        {
          title: 'Draft Guide',
          slug: 'draft-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'A draft guide',
          status: 'draft',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date('2024-01-03'),
        },
        {
          title: 'Archived Guide',
          slug: 'archived-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'An archived guide',
          status: 'archived',
          version: 3,
          created_by: adminUserId,
          updated_at: new Date('2024-01-01'),
        },
      ]);
    });

    it('should only return published guides for workers', async () => {
      const results = await searchService.searchGuides(undefined, {}, 'worker');
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('published');
    });

    it('should return all guides for admins when no status filter', async () => {
      const results = await searchService.searchGuides(undefined, {}, 'admin');
      expect(results.length).toBe(3);
    });

    it('should apply status filter for admins', async () => {
      const results = await searchService.searchGuides(undefined, { status: 'published' }, 'admin');
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('published');
    });
  });

  describe('filters', () => {
    let tagId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      const tag = await Tag.create({ name: 'water-cooling' });
      tagId = tag._id as mongoose.Types.ObjectId;

      await CabinetGuide.create([
        {
          title: 'VSD Guide One',
          slug: 'vsd-guide-one',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'First VSD guide',
          status: 'published',
          version: 1,
          tags: [tagId],
          created_by: adminUserId,
          updated_at: new Date('2024-01-03'),
        },
        {
          title: 'VSD Guide Two',
          slug: 'vsd-guide-two',
          cabinet_type: 'VSD',
          drive_model: 'ATV320',
          description: 'Second VSD guide',
          status: 'published',
          version: 1,
          tags: [],
          created_by: adminUserId,
          updated_at: new Date('2024-01-02'),
        },
        {
          title: 'MCC Guide',
          slug: 'mcc-guide',
          cabinet_type: 'MCC',
          drive_model: 'ATV630',
          description: 'MCC section guide',
          status: 'published',
          version: 1,
          tags: [tagId],
          created_by: adminUserId,
          updated_at: new Date('2024-01-01'),
        },
      ]);
    });

    it('should filter by cabinetType', async () => {
      const results = await searchService.searchGuides(undefined, { cabinetType: 'VSD' }, 'worker');
      expect(results.length).toBe(2);
      results.forEach((r) => expect(r.cabinet_type).toBe('VSD'));
    });

    it('should filter by driveModel using regex (case-insensitive)', async () => {
      const results = await searchService.searchGuides(undefined, { driveModel: 'atv630' }, 'worker');
      expect(results.length).toBe(2);
      results.forEach((r) => expect(r.drive_model.toLowerCase()).toContain('atv630'));
    });

    it('should filter by tags ($in)', async () => {
      const results = await searchService.searchGuides(
        undefined,
        { tags: [tagId.toString()] },
        'worker'
      );
      expect(results.length).toBe(2);
    });

    it('should combine multiple filters (AND logic)', async () => {
      const results = await searchService.searchGuides(
        undefined,
        { cabinetType: 'VSD', driveModel: 'ATV630' },
        'worker'
      );
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('VSD Guide One');
    });
  });

  describe('filter-only queries (no text)', () => {
    beforeEach(async () => {
      await CabinetGuide.create([
        {
          title: 'Newest Guide',
          slug: 'newest-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'The newest guide',
          status: 'published',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date('2024-03-01'),
        },
        {
          title: 'Middle Guide',
          slug: 'middle-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV320',
          description: 'A middle guide',
          status: 'published',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date('2024-02-01'),
        },
        {
          title: 'Oldest Guide',
          slug: 'oldest-guide',
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: 'The oldest guide',
          status: 'published',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date('2024-01-01'),
        },
      ]);
    });

    it('should sort by updated_at descending when no text query', async () => {
      const results = await searchService.searchGuides(undefined, {}, 'worker');
      expect(results.length).toBe(3);
      expect(results[0].title).toBe('Newest Guide');
      expect(results[1].title).toBe('Middle Guide');
      expect(results[2].title).toBe('Oldest Guide');
    });
  });

  describe('result limits', () => {
    beforeEach(async () => {
      // Create 55 published guides
      const guides = [];
      for (let i = 1; i <= 55; i++) {
        guides.push({
          title: `Assembly Guide ${i}`,
          slug: `assembly-guide-${i}`,
          cabinet_type: 'VSD',
          drive_model: 'ATV630',
          description: `Guide number ${i} for assembly`,
          status: 'published',
          version: 1,
          created_by: adminUserId,
          updated_at: new Date(Date.now() - i * 1000),
        });
      }
      await CabinetGuide.create(guides);
    });

    it('should return maximum 50 results', async () => {
      const results = await searchService.searchGuides(undefined, {}, 'worker');
      expect(results.length).toBe(50);
    });
  });
});
