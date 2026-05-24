import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
  name: string;
  created_at: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      minlength: [1, 'Tag name must be at least 1 character'],
      maxlength: [50, 'Tag name must not exceed 50 characters'],
      trim: true,
      lowercase: true,
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

// Case-insensitive unique index on name
TagSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Tag = mongoose.model<ITag>('Tag', TagSchema);
