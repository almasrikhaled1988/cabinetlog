import { CabinetGuide } from '../models/CabinetGuide';
import { BuildStep } from '../models/BuildStep';
import { WorkerProgress } from '../models/WorkerProgress';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { Types } from 'mongoose';

export const analyticsService = {
  /**
   * Get overall platform statistics.
   */
  async getOverview() {
    const [
      totalGuides,
      publishedGuides,
      draftGuides,
      archivedGuides,
      totalSteps,
      totalUsers,
      totalWorkers,
      totalAdmins,
      openComments,
    ] = await Promise.all([
      CabinetGuide.countDocuments(),
      CabinetGuide.countDocuments({ status: 'published' }),
      CabinetGuide.countDocuments({ status: 'draft' }),
      CabinetGuide.countDocuments({ status: 'archived' }),
      BuildStep.countDocuments(),
      User.countDocuments({ active: { $ne: false } }),
      User.countDocuments({ role: 'worker', active: { $ne: false } }),
      User.countDocuments({ role: 'admin', active: { $ne: false } }),
      Comment.countDocuments({ status: 'open' }),
    ]);

    return {
      guides: { total: totalGuides, published: publishedGuides, draft: draftGuides, archived: archivedGuides },
      steps: { total: totalSteps },
      users: { total: totalUsers, workers: totalWorkers, admins: totalAdmins },
      comments: { open: openComments },
    };
  },

  /**
   * Get most active guides (by worker completions).
   */
  async getMostActiveGuides(limit = 10) {
    const results = await WorkerProgress.aggregate([
      {
        $group: {
          _id: '$guide_id',
          total_completions: { $sum: 1 },
          unique_workers: { $addToSet: '$user_id' },
          avg_time_spent: { $avg: { $ifNull: ['$time_spent', 0] } },
          last_activity: { $max: '$completed_at' },
        },
      },
      {
        $addFields: {
          unique_worker_count: { $size: '$unique_workers' },
        },
      },
      { $sort: { total_completions: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'cabinetguides',
          localField: '_id',
          foreignField: '_id',
          as: 'guide',
        },
      },
      { $unwind: '$guide' },
      {
        $project: {
          guide_id: '$_id',
          title: '$guide.title',
          cabinet_type: '$guide.cabinet_type',
          total_completions: 1,
          unique_worker_count: 1,
          avg_time_spent: 1,
          last_activity: 1,
        },
      },
    ]);

    return results;
  },

  /**
   * Get worker activity summary.
   */
  async getWorkerActivity(limit = 20) {
    const results = await WorkerProgress.aggregate([
      {
        $group: {
          _id: '$user_id',
          total_steps_completed: { $sum: 1 },
          guides_worked_on: { $addToSet: '$guide_id' },
          total_time_spent: { $sum: { $ifNull: ['$time_spent', 0] } },
          last_activity: { $max: '$completed_at' },
        },
      },
      {
        $addFields: {
          guides_count: { $size: '$guides_worked_on' },
        },
      },
      { $sort: { last_activity: -1 } },
      { $limit: limit },
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
          name: '$user.name',
          email: '$user.email',
          total_steps_completed: 1,
          guides_count: 1,
          total_time_spent: 1,
          last_activity: 1,
        },
      },
    ]);

    return results;
  },

  /**
   * Get steps with most issues (comments).
   */
  async getProblematicSteps(limit = 10) {
    const results = await Comment.aggregate([
      { $match: { status: { $in: ['open', 'in_progress'] } } },
      {
        $group: {
          _id: '$step_id',
          guide_id: { $first: '$guide_id' },
          issue_count: { $sum: 1 },
          categories: { $push: '$category' },
        },
      },
      { $sort: { issue_count: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'buildsteps',
          localField: '_id',
          foreignField: '_id',
          as: 'step',
        },
      },
      { $unwind: '$step' },
      {
        $lookup: {
          from: 'cabinetguides',
          localField: 'guide_id',
          foreignField: '_id',
          as: 'guide',
        },
      },
      { $unwind: '$guide' },
      {
        $project: {
          step_id: '$_id',
          step_title: '$step.title',
          step_order: '$step.step_order',
          guide_title: '$guide.title',
          guide_id: '$guide._id',
          issue_count: 1,
        },
      },
    ]);

    return results;
  },

  /**
   * Get average completion time per guide.
   */
  async getAvgCompletionTimes() {
    const results = await WorkerProgress.aggregate([
      { $match: { time_spent: { $gt: 0 } } },
      {
        $group: {
          _id: { guide_id: '$guide_id', step_id: '$step_id' },
          avg_time: { $avg: '$time_spent' },
        },
      },
      {
        $group: {
          _id: '$_id.guide_id',
          total_avg_time: { $sum: '$avg_time' },
          steps_with_data: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'cabinetguides',
          localField: '_id',
          foreignField: '_id',
          as: 'guide',
        },
      },
      { $unwind: '$guide' },
      {
        $lookup: {
          from: 'buildsteps',
          localField: '_id',
          foreignField: 'cabinet_guide_id',
          as: 'all_steps',
        },
      },
      {
        $project: {
          guide_id: '$_id',
          title: '$guide.title',
          total_avg_time: 1,
          steps_with_data: 1,
          total_steps: { $size: '$all_steps' },
          estimated_total: {
            $reduce: {
              input: '$all_steps',
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.estimated_time', 0] }] },
            },
          },
        },
      },
      { $sort: { total_avg_time: -1 } },
    ]);

    return results;
  },
};
