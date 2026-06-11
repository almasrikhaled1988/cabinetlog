import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  user_id: Types.ObjectId;
  action: string;
  resource_type: string;
  resource_id?: Types.ObjectId;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'login_failed',
        'register',
        'password_change',
        'guide_create',
        'guide_update',
        'guide_delete',
        'guide_status_change',
        'guide_duplicate',
        'step_create',
        'step_update',
        'step_delete',
        'step_reorder',
        'media_upload',
        'media_delete',
        'user_create',
        'user_update',
        'user_deactivate',
        'comment_create',
        'comment_resolve',
      ],
    },
    resource_type: {
      type: String,
      required: true,
      enum: ['user', 'guide', 'step', 'media', 'comment', 'auth'],
    },
    resource_id: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    details: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    ip_address: {
      type: String,
      default: undefined,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

AuditLogSchema.index({ user_id: 1, created_at: -1 });
AuditLogSchema.index({ resource_type: 1, resource_id: 1 });
AuditLogSchema.index({ action: 1, created_at: -1 });
AuditLogSchema.index({ created_at: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
