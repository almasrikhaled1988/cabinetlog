import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  user_id: Types.ObjectId;
  token: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

RefreshTokenSchema.index({ token: 1 }, { unique: true });
RefreshTokenSchema.index({ user_id: 1 });
RefreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
