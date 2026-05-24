import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBuildStep extends Document {
  cabinet_guide_id: Types.ObjectId;
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
  created_at: Date;
}

const BuildStepSchema = new Schema<IBuildStep>(
  {
    cabinet_guide_id: {
      type: Schema.Types.ObjectId,
      ref: 'CabinetGuide',
      required: [true, 'Cabinet guide reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title must not exceed 200 characters'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    step_order: {
      type: Number,
      required: [true, 'Step order is required'],
      min: [1, 'Step order must be a positive integer'],
      validate: {
        validator: function (v: number) {
          return Number.isInteger(v) && v > 0;
        },
        message: 'Step order must be a positive integer',
      },
    },
    estimated_time: {
      type: Number,
      default: undefined,
      validate: {
        validator: function (v: number | undefined) {
          if (v === undefined || v === null) return true;
          return v > 0 && v <= 10080;
        },
        message: 'Estimated time must be a positive number not exceeding 10080 minutes',
      },
    },
    warning_notes: {
      type: String,
      default: undefined,
      maxlength: [1000, 'Warning notes must not exceed 1000 characters'],
      trim: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index on (cabinet_guide_id, step_order) for ordering within a guide
BuildStepSchema.index({ cabinet_guide_id: 1, step_order: 1 }, { unique: true });

export const BuildStep = mongoose.model<IBuildStep>('BuildStep', BuildStepSchema);
