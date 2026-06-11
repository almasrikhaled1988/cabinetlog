import { AuditLog } from '../models/AuditLog';
import { Types } from 'mongoose';

export interface AuditEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export const auditService = {
  async log(entry: AuditEntry): Promise<void> {
    try {
      await AuditLog.create({
        user_id: new Types.ObjectId(entry.userId),
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ? new Types.ObjectId(entry.resourceId) : undefined,
        details: entry.details,
        ip_address: entry.ipAddress,
        created_at: new Date(),
      });
    } catch (err) {
      // Audit logging should never break the main flow
      console.error('Audit log failed:', err);
    }
  },

  async getByResource(resourceType: string, resourceId: string, limit = 50) {
    return AuditLog.find({
      resource_type: resourceType,
      resource_id: new Types.ObjectId(resourceId),
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('user_id', 'name email')
      .lean();
  },

  async getByUser(userId: string, limit = 50) {
    return AuditLog.find({ user_id: new Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
  },

  async getRecent(limit = 100) {
    return AuditLog.find()
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('user_id', 'name email')
      .lean();
  },
};
