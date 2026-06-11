import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGuideMaterial extends Document {
  guide_id: Types.ObjectId;
  name: string;
  quantity: number;
  unit: string;
  category: 'tool' | 'consumable' | 'component';
  part_number?: string;
  sort_order: number;
  created_at: Date;
}

const GuideMaterialSchema = new Schema<IGuideMaterial>(
  {
    guide_id: {
      type: Schema.Types.ObjectId,
      ref: 'CabinetGuide',
      required: true,
    },
    name: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 200,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['tool', 'consumable', 'component'],
    },
    part_number: {
      type: String,
      default: undefined,
      maxlength: 100,
      trim: true,
    },
    sort_order: {
      type: Number,
      default: 0,
      min: 0,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

GuideMaterialSchema.index({ guide_id: 1, sort_order: 1 });

export const GuideMaterial = mongoose.model<IGuideMaterial>('GuideMaterial', GuideMaterialSchema);
