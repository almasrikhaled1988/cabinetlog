import { Comment } from '../models/Comment';
import { BuildStep } from '../models/BuildStep';
import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export const commentService = {
  /**
   * Create a new comment on a step.
   */
  async create(data: {
    stepId: string;
    guideId: string;
    userId: string;
    category: 'error' | 'improvement' | 'question';
    text: string;
  }) {
    const step = await BuildStep.findById(data.stepId);
    if (!step) {
      throw new NotFoundError('Step not found');
    }

    if (!data.text || data.text.trim().length === 0) {
      throw new ValidationError('Comment text is required');
    }

    if (data.text.length > 2000) {
      throw new ValidationError('Comment must not exceed 2000 characters');
    }

    const comment = await Comment.create({
      step_id: new Types.ObjectId(data.stepId),
      guide_id: new Types.ObjectId(data.guideId),
      user_id: new Types.ObjectId(data.userId),
      category: data.category,
      text: data.text.trim(),
      status: 'open',
    });

    return comment;
  },

  /**
   * Get comments for a guide, optionally filtered by status.
   */
  async getByGuide(guideId: string, status?: string) {
    const query: Record<string, unknown> = {
      guide_id: new Types.ObjectId(guideId),
    };
    if (status) {
      query.status = status;
    }

    return Comment.find(query)
      .sort({ created_at: -1 })
      .populate('user_id', 'name email')
      .populate('replied_by', 'name')
      .populate('step_id', 'title step_order')
      .lean();
  },

  /**
   * Get comments for a specific step.
   */
  async getByStep(stepId: string) {
    return Comment.find({ step_id: new Types.ObjectId(stepId) })
      .sort({ created_at: -1 })
      .populate('user_id', 'name email')
      .populate('replied_by', 'name')
      .lean();
  },

  /**
   * Update comment status (admin).
   */
  async updateStatus(commentId: string, status: 'open' | 'in_progress' | 'resolved') {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    comment.status = status;
    comment.updated_at = new Date();
    await comment.save();
    return comment;
  },

  /**
   * Reply to a comment (admin).
   */
  async reply(commentId: string, adminId: string, replyText: string) {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (!replyText || replyText.trim().length === 0) {
      throw new ValidationError('Reply text is required');
    }

    comment.reply = replyText.trim();
    comment.replied_by = new Types.ObjectId(adminId);
    comment.replied_at = new Date();
    comment.status = 'resolved';
    comment.updated_at = new Date();
    await comment.save();
    return comment;
  },

  /**
   * Get comment counts by status for a guide.
   */
  async getCountsByGuide(guideId: string) {
    const counts = await Comment.aggregate([
      { $match: { guide_id: new Types.ObjectId(guideId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = { open: 0, in_progress: 0, resolved: 0, total: 0 };
    for (const c of counts) {
      (result as any)[c._id] = c.count;
      result.total += c.count;
    }
    return result;
  },
};
