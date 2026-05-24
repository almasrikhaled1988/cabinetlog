import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { StepMedia } from '../models/StepMedia';
import { User } from '../models/User';
import { stepService, validateStepFields } from './stepService';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';

let mongoServer: MongoMemoryServer;
let adminUserId: string;
let guideId: string;

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

  // Create a test guide
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

describe('validateStepFields', () => {
  it('should return error for missing title on create', () => {
    const errors = validateStepFields({}, true);
    expect(errors.title).toBeDefined();
  });

  it('should return error for title shorter than 3 chars', () => {
    const errors = validateStepFields({ title: 'ab' }, false);
    expect(errors.title).toBeDefined();
  });

  it('should return error for title longer than 200 chars', () => {
    const errors = validateStepFields({ title: 'a'.repeat(201) }, false);
    expect(errors.title).toBeDefined();
  });

  it('should return error for warning_notes exceeding 1000 chars', () => {
    const errors = validateStepFields({ warning_notes: 'a'.repeat(1001) }, false);
    expect(errors.warning_notes).toBeDefined();
  });

  it('should return error for non-positive estimated_time', () => {
    const errors = validateStepFields({ estimated_time: 0 }, false);
    expect(errors.estimated_time).toBeDefined();
  });

  it('should return error for estimated_time exceeding 10080', () => {
    const errors = validateStepFields({ estimated_time: 10081 }, false);
    expect(errors.estimated_time).toBeDefined();
  });

  it('should return error for negative estimated_time', () => {
    const errors = validateStepFields({ estimated_time: -5 }, false);
    expect(errors.estimated_time).toBeDefined();
  });

  it('should return error for non-integer step_order', () => {
    const errors = validateStepFields({ step_order: 1.5 }, false);
    expect(errors.step_order).toBeDefined();
  });

  it('should return error for zero step_order', () => {
    const errors = validateStepFields({ step_order: 0 }, false);
    expect(errors.step_order).toBeDefined();
  });

  it('should return error for negative step_order', () => {
    const errors = validateStepFields({ step_order: -1 }, false);
    expect(errors.step_order).toBeDefined();
  });

  it('should return no errors for valid data', () => {
    const errors = validateStepFields(
      {
        title: 'Valid Step Title',
        step_order: 1,
        warning_notes: 'Be careful',
        estimated_time: 30,
      },
      true
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should accept boundary values', () => {
    const errors = validateStepFields(
      {
        title: 'abc', // exactly 3 chars
        estimated_time: 10080, // max allowed
        warning_notes: 'a'.repeat(1000), // exactly 1000 chars
      },
      true
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('stepService.createStep', () => {
  it('should create a step with step_order 1 for first step', async () => {
    const step = await stepService.createStep(guideId, {
      title: 'First Step',
      description: 'Install DIN rails',
      step_order: 1,
    });

    expect(step.title).toBe('First Step');
    expect(step.step_order).toBe(1);
    expect(step.cabinet_guide_id.toString()).toBe(guideId);
  });

  it('should auto-assign step_order as max + 1', async () => {
    await stepService.createStep(guideId, {
      title: 'Step One',
      description: 'First',
      step_order: 1,
    });

    const step2 = await stepService.createStep(guideId, {
      title: 'Step Two',
      description: 'Second',
      step_order: 1, // provided value is ignored, auto-assigned
    });

    expect(step2.step_order).toBe(2);
  });

  it('should auto-assign step_order correctly after multiple steps', async () => {
    await stepService.createStep(guideId, {
      title: 'Step One',
      description: 'First',
      step_order: 1,
    });
    await stepService.createStep(guideId, {
      title: 'Step Two',
      description: 'Second',
      step_order: 1,
    });

    const step3 = await stepService.createStep(guideId, {
      title: 'Step Three',
      description: 'Third',
      step_order: 1,
    });

    expect(step3.step_order).toBe(3);
  });

  it('should trim the title', async () => {
    const step = await stepService.createStep(guideId, {
      title: '  Trimmed Title  ',
      description: 'Test',
      step_order: 1,
    });

    expect(step.title).toBe('Trimmed Title');
  });

  it('should set optional fields when provided', async () => {
    const step = await stepService.createStep(guideId, {
      title: 'Step with extras',
      description: 'Detailed description',
      step_order: 1,
      estimated_time: 45,
      warning_notes: 'Handle with care',
    });

    expect(step.estimated_time).toBe(45);
    expect(step.warning_notes).toBe('Handle with care');
  });

  it('should throw ValidationError for title too short', async () => {
    await expect(
      stepService.createStep(guideId, {
        title: 'ab',
        description: 'Test',
        step_order: 1,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for title too long', async () => {
    await expect(
      stepService.createStep(guideId, {
        title: 'a'.repeat(201),
        description: 'Test',
        step_order: 1,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for estimated_time exceeding 10080', async () => {
    await expect(
      stepService.createStep(guideId, {
        title: 'Valid Title',
        description: 'Test',
        step_order: 1,
        estimated_time: 10081,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for warning_notes exceeding 1000 chars', async () => {
    await expect(
      stepService.createStep(guideId, {
        title: 'Valid Title',
        description: 'Test',
        step_order: 1,
        warning_notes: 'a'.repeat(1001),
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe('stepService.updateStep', () => {
  let stepId: string;

  beforeEach(async () => {
    const step = await stepService.createStep(guideId, {
      title: 'Original Step',
      description: 'Original description',
      step_order: 1,
    });
    stepId = (step._id as mongoose.Types.ObjectId).toString();
  });

  it('should update title', async () => {
    const updated = await stepService.updateStep(stepId, { title: 'Updated Title' });
    expect(updated.title).toBe('Updated Title');
  });

  it('should update description', async () => {
    const updated = await stepService.updateStep(stepId, { description: 'New description' });
    expect(updated.description).toBe('New description');
  });

  it('should update estimated_time', async () => {
    const updated = await stepService.updateStep(stepId, { estimated_time: 60 });
    expect(updated.estimated_time).toBe(60);
  });

  it('should update warning_notes', async () => {
    const updated = await stepService.updateStep(stepId, { warning_notes: 'Caution!' });
    expect(updated.warning_notes).toBe('Caution!');
  });

  it('should throw NotFoundError for non-existent step', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      stepService.updateStep(fakeId, { title: 'New Title' })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError for invalid title', async () => {
    await expect(
      stepService.updateStep(stepId, { title: 'ab' })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid estimated_time', async () => {
    await expect(
      stepService.updateStep(stepId, { estimated_time: -1 })
    ).rejects.toThrow(ValidationError);
  });
});

describe('stepService.deleteStep', () => {
  it('should delete a step and its media records', async () => {
    const step = await stepService.createStep(guideId, {
      title: 'Step to Delete',
      description: 'Will be deleted',
      step_order: 1,
    });
    const stepId = (step._id as mongoose.Types.ObjectId).toString();

    // Create media record (file won't exist, but deletion handles gracefully)
    await StepMedia.create({
      build_step_id: stepId,
      file_type: 'image',
      file_path: 'images/nonexistent.jpg',
      original_name: 'test.jpg',
      file_size: 1024,
      sort_order: 1,
    });

    await stepService.deleteStep(stepId);

    const deletedStep = await BuildStep.findById(stepId);
    const remainingMedia = await StepMedia.find({ build_step_id: stepId });

    expect(deletedStep).toBeNull();
    expect(remainingMedia).toHaveLength(0);
  });

  it('should reassign step_order to contiguous 1..N after deletion', async () => {
    const step1 = await stepService.createStep(guideId, {
      title: 'Step One',
      description: 'First',
      step_order: 1,
    });
    await stepService.createStep(guideId, {
      title: 'Step Two',
      description: 'Second',
      step_order: 2,
    });
    await stepService.createStep(guideId, {
      title: 'Step Three',
      description: 'Third',
      step_order: 3,
    });

    // Delete the first step
    await stepService.deleteStep((step1._id as mongoose.Types.ObjectId).toString());

    // Remaining steps should be reordered to 1, 2
    const remaining = await BuildStep.find({ cabinet_guide_id: guideId }).sort({ step_order: 1 });
    expect(remaining).toHaveLength(2);
    expect(remaining[0].step_order).toBe(1);
    expect(remaining[0].title).toBe('Step Two');
    expect(remaining[1].step_order).toBe(2);
    expect(remaining[1].title).toBe('Step Three');
  });

  it('should throw NotFoundError for non-existent step', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(stepService.deleteStep(fakeId)).rejects.toThrow(NotFoundError);
  });
});

describe('stepService.reorderSteps', () => {
  let step1Id: string;
  let step2Id: string;
  let step3Id: string;

  beforeEach(async () => {
    const s1 = await stepService.createStep(guideId, {
      title: 'Step One',
      description: 'First',
      step_order: 1,
    });
    const s2 = await stepService.createStep(guideId, {
      title: 'Step Two',
      description: 'Second',
      step_order: 2,
    });
    const s3 = await stepService.createStep(guideId, {
      title: 'Step Three',
      description: 'Third',
      step_order: 3,
    });
    step1Id = (s1._id as mongoose.Types.ObjectId).toString();
    step2Id = (s2._id as mongoose.Types.ObjectId).toString();
    step3Id = (s3._id as mongoose.Types.ObjectId).toString();
  });

  it('should reorder steps to match provided ID sequence', async () => {
    const result = await stepService.reorderSteps(guideId, [step3Id, step1Id, step2Id]);

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Step Three');
    expect(result[0].step_order).toBe(1);
    expect(result[1].title).toBe('Step One');
    expect(result[1].step_order).toBe(2);
    expect(result[2].title).toBe('Step Two');
    expect(result[2].step_order).toBe(3);
  });

  it('should produce contiguous step_order values 1..N', async () => {
    const result = await stepService.reorderSteps(guideId, [step2Id, step3Id, step1Id]);

    for (let i = 0; i < result.length; i++) {
      expect(result[i].step_order).toBe(i + 1);
    }
  });

  it('should reject duplicate step IDs', async () => {
    await expect(
      stepService.reorderSteps(guideId, [step1Id, step1Id, step2Id])
    ).rejects.toThrow(ValidationError);

    // Verify step_order unchanged
    const steps = await BuildStep.find({ cabinet_guide_id: guideId }).sort({ step_order: 1 });
    expect(steps[0].step_order).toBe(1);
    expect(steps[1].step_order).toBe(2);
    expect(steps[2].step_order).toBe(3);
  });

  it('should reject step IDs not belonging to the guide', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      stepService.reorderSteps(guideId, [step1Id, step2Id, fakeId])
    ).rejects.toThrow(ValidationError);
  });

  it('should reject incomplete list of step IDs', async () => {
    await expect(
      stepService.reorderSteps(guideId, [step1Id, step2Id])
    ).rejects.toThrow(ValidationError);
  });

  it('should leave step_order unchanged on validation failure', async () => {
    // Attempt invalid reorder
    await expect(
      stepService.reorderSteps(guideId, [step1Id, step2Id])
    ).rejects.toThrow(ValidationError);

    // Verify original order preserved
    const steps = await BuildStep.find({ cabinet_guide_id: guideId }).sort({ step_order: 1 });
    expect((steps[0]._id as mongoose.Types.ObjectId).toString()).toBe(step1Id);
    expect(steps[0].step_order).toBe(1);
    expect((steps[1]._id as mongoose.Types.ObjectId).toString()).toBe(step2Id);
    expect(steps[1].step_order).toBe(2);
    expect((steps[2]._id as mongoose.Types.ObjectId).toString()).toBe(step3Id);
    expect(steps[2].step_order).toBe(3);
  });
});

describe('stepService.getStepsByGuide', () => {
  it('should return steps sorted by step_order', async () => {
    await stepService.createStep(guideId, {
      title: 'Step One',
      description: 'First',
      step_order: 1,
    });
    await stepService.createStep(guideId, {
      title: 'Step Two',
      description: 'Second',
      step_order: 2,
    });
    await stepService.createStep(guideId, {
      title: 'Step Three',
      description: 'Third',
      step_order: 3,
    });

    const steps = await stepService.getStepsByGuide(guideId);

    expect(steps).toHaveLength(3);
    expect(steps[0].title).toBe('Step One');
    expect(steps[0].step_order).toBe(1);
    expect(steps[1].title).toBe('Step Two');
    expect(steps[1].step_order).toBe(2);
    expect(steps[2].title).toBe('Step Three');
    expect(steps[2].step_order).toBe(3);
  });

  it('should return empty array for guide with no steps', async () => {
    const steps = await stepService.getStepsByGuide(guideId);
    expect(steps).toHaveLength(0);
  });

  it('should only return steps for the specified guide', async () => {
    // Create steps for our guide
    await stepService.createStep(guideId, {
      title: 'Our Step',
      description: 'Ours',
      step_order: 1,
    });

    // Create another guide with steps
    const otherGuide = await CabinetGuide.create({
      title: 'Other Guide',
      slug: 'other-guide',
      cabinet_type: 'MCC',
      status: 'draft',
      version: 1,
      created_by: adminUserId,
      updated_at: new Date(),
    });
    const otherGuideId = (otherGuide._id as mongoose.Types.ObjectId).toString();
    await stepService.createStep(otherGuideId, {
      title: 'Other Step',
      description: 'Other',
      step_order: 1,
    });

    const steps = await stepService.getStepsByGuide(guideId);
    expect(steps).toHaveLength(1);
    expect(steps[0].title).toBe('Our Step');
  });
});
