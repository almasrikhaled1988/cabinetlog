import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWorkerProgress extends Document {
  user_id: Types.ObjectId;
  guide_id: Types.ObjectId;
  step_id: Types.ObjectId;
  completed_at: Date;
  time_spent?: number; // seconds
}

const WorkerProgressSchema = new Schema<IWorkerProgress>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    guide_id: {
      type: Schema.Types.ObjectId,
      ref: 'CabinetGuide',
      required: true,
    },
    step_id: {
      type: Schema.Types.ObjectId,
      ref: 'BuildStep',
      required: true,
    },
    completed_at: {
      type: Date,
      default: Date.now,
    },
    time_spent: {
      type: Number,
      default: undefined,
      min: [0, 'Time spent must be non-negative'],
    },
  },
  { timestamps: false }
);

// A user can complete a step only once
WorkerProgressSchema.index({ user_id: 1, step_id: 1 }, { unique: true });
// Query progress by user + guide
WorkerProgressSchema.index({ user_id: 1, guide_id: 1 });
// Analytics: all completions for a guide
WorkerProgressSchema.index({ guide_id: 1, completed_at: -1 });

export const WorkerProgress = mongoose.model<IWorkerProgress>(
  'WorkerProgress',
  WorkerProgressSchema
);
