import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComment extends Document {
  step_id: Types.ObjectId;
  guide_id: Types.ObjectId;
  user_id: Types.ObjectId;
  category: 'error' | 'improvement' | 'question';
  status: 'open' | 'in_progress' | 'resolved';
  text: string;
  reply?: string;
  replied_by?: Types.ObjectId;
  replied_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    step_id: {
      type: Schema.Types.ObjectId,
      ref: 'BuildStep',
      required: true,
    },
    guide_id: {
      type: Schema.Types.ObjectId,
      ref: 'CabinetGuide',
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['error', 'improvement', 'question'],
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    text: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 2000,
      trim: true,
    },
    reply: {
      type: String,
      default: undefined,
      maxlength: 2000,
      trim: true,
    },
    replied_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    replied_at: {
      type: Date,
      default: undefined,
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
  { timestamps: false }
);

CommentSchema.index({ guide_id: 1, status: 1 });
CommentSchema.index({ step_id: 1, created_at: -1 });
CommentSchema.index({ user_id: 1, created_at: -1 });
CommentSchema.index({ status: 1, created_at: -1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
