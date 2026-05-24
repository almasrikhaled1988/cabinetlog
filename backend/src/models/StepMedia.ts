import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStepMedia extends Document {
  build_step_id: Types.ObjectId;
  file_type: 'image' | 'pdf';
  file_path: string;
  original_name: string;
  file_size: number;
  caption?: string;
  sort_order: number;
  created_at: Date;
}

const StepMediaSchema = new Schema<IStepMedia>(
  {
    build_step_id: {
      type: Schema.Types.ObjectId,
      ref: 'BuildStep',
      required: [true, 'Build step reference is required'],
    },
    file_type: {
      type: String,
      required: [true, 'File type is required'],
      enum: {
        values: ['image', 'pdf'],
        message: 'File type must be image or pdf',
      },
    },
    file_path: {
      type: String,
      required: [true, 'File path is required'],
      trim: true,
    },
    original_name: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    file_size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size must be non-negative'],
    },
    caption: {
      type: String,
      default: undefined,
      trim: true,
    },
    sort_order: {
      type: Number,
      required: [true, 'Sort order is required'],
      default: 0,
      min: [0, 'Sort order must be non-negative'],
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

// Index for querying media by build step, ordered by sort_order
StepMediaSchema.index({ build_step_id: 1, sort_order: 1 });

export const StepMedia = mongoose.model<IStepMedia>('StepMedia', StepMediaSchema);
