import { WorkerProgress } from '../models/WorkerProgress';
import { BuildStep } from '../models/BuildStep';
import { Types } from 'mongoose';
import { NotFoundError } from '../middleware/errorHandler';

export const progressService = {
  /**
   * Mark a step as complete for a user.
   */
  async markComplete(
    userId: string,
    guideId: string,
    stepId: string,
    timeSpent?: number
  ) {
    // Verify step exists and belongs to this guide
    const step = await BuildStep.findOne({
      _id: stepId,
      cabinet_guide_id: guideId,
    });
    if (!step) {
      throw new NotFoundError('Step not found in this guide');
    }

    // Upsert progress
    const progress = await WorkerProgress.findOneAndUpdate(
      { user_id: new Types.ObjectId(userId), step_id: new Types.ObjectId(stepId) },
      {
        user_id: new Types.ObjectId(userId),
        guide_id: new Types.ObjectId(guideId),
        step_id: new Types.ObjectId(stepId),
        completed_at: new Date(),
        time_spent: timeSpent,
      },
      { upsert: true, new: true }
    );

    return progress;
  },

  /**
   * Unmark a step for a user.
   */
  async unmarkComplete(userId: string, stepId: string) {
    await WorkerProgress.deleteOne({
      user_id: new Types.ObjectId(userId),
      step_id: new Types.ObjectId(stepId),
    });
  },

  /**
   * Get all completed steps for a user in a guide.
   */
  async getGuideProgress(userId: string, guideId: string) {
    return WorkerProgress.find({
      user_id: new Types.ObjectId(userId),
      guide_id: new Types.ObjectId(guideId),
    }).lean();
  },

  /**
   * Get progress summary for a guide across all workers.
   */
  async getGuideProgressSummary(guideId: string) {
    const totalSteps = await BuildStep.countDocuments({
      cabinet_guide_id: guideId,
    });

    const completions = await WorkerProgress.aggregate([
      { $match: { guide_id: new Types.ObjectId(guideId) } },
      {
        $group: {
          _id: '$user_id',
          completed_steps: { $sum: 1 },
          total_time_spent: { $sum: { $ifNull: ['$time_spent', 0] } },
          last_activity: { $max: '$completed_at' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          user_id: '$_id',
          user_name: '$user.name',
          user_email: '$user.email',
          completed_steps: 1,
          total_steps: { $literal: totalSteps },
          total_time_spent: 1,
          last_activity: 1,
          progress_percent: {
            $multiply: [{ $divide: ['$completed_steps', { $max: [totalSteps, 1] }] }, 100],
          },
        },
      },
      { $sort: { last_activity: -1 } },
    ]);

    return { totalSteps, completions };
  },
};
