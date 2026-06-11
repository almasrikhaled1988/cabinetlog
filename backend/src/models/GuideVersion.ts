import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGuideVersion extends Document {
  guide_id: Types.ObjectId;
  version: number;
  snapshot: {
    title: string;
    cabinet_type: string;
    drive_model: string;
    description: string;
    tags: string[];
    steps: Array<{
      title: string;
      description: string;
      step_order: number;
      estimated_time?: number;
      warning_notes?: string;
      checklist_items?: Array<{ text: string; required: boolean }>;
    }>;
  };
  changelog?: string;
  published_by: Types.ObjectId;
  created_at: Date;
}

const GuideVersionSchema = new Schema<IGuideVersion>(
  {
    guide_id: {
      type: Schema.Types.ObjectId,
      ref: 'CabinetGuide',
      required: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    changelog: {
      type: String,
      default: undefined,
      maxlength: 2000,
    },
    published_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

GuideVersionSchema.index({ guide_id: 1, version: -1 }, { unique: true });

export const GuideVersion = mongoose.model<IGuideVersion>('GuideVersion', GuideVersionSchema);
