import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICabinetGuide extends Document {
  title: string;
  slug: string;
  cabinet_type: string;
  drive_model: string;
  description: string;
  thumbnail_image?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  is_template: boolean;
  tags: Types.ObjectId[];
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const CabinetGuideSchema = new Schema<ICabinetGuide>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title must not exceed 200 characters'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      maxlength: [200, 'Slug must not exceed 200 characters'],
      trim: true,
      lowercase: true,
    },
    cabinet_type: {
      type: String,
      required: [true, 'Cabinet type is required'],
      minlength: [1, 'Cabinet type must be at least 1 character'],
      maxlength: [100, 'Cabinet type must not exceed 100 characters'],
      trim: true,
    },
    drive_model: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [5000, 'Description must not exceed 5000 characters'],
      trim: true,
    },
    thumbnail_image: {
      type: String,
      default: undefined,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: 'Status must be draft, published, or archived',
      },
      default: 'draft',
    },
    version: {
      type: Number,
      default: 1,
      min: [1, 'Version must be at least 1'],
    },
    is_template: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Unique slug index
CabinetGuideSchema.index({ slug: 1 }, { unique: true });

// Text index for full-text search on title, description, drive_model, cabinet_type
CabinetGuideSchema.index(
  {
    title: 'text',
    description: 'text',
    drive_model: 'text',
    cabinet_type: 'text',
  },
  {
    weights: {
      title: 10,
      drive_model: 5,
      cabinet_type: 5,
      description: 1,
    },
    name: 'guide_text_search',
  }
);

// Index for listing/filtering
CabinetGuideSchema.index({ status: 1, updated_at: -1 });

export const CabinetGuide = mongoose.model<ICabinetGuide>('CabinetGuide', CabinetGuideSchema);
