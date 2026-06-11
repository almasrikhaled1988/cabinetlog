import { GuideMaterial } from '../models/GuideMaterial';
import { CabinetGuide } from '../models/CabinetGuide';
import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export const materialService = {
  /**
   * Get all materials for a guide.
   */
  async getByGuide(guideId: string) {
    return GuideMaterial.find({ guide_id: new Types.ObjectId(guideId) })
      .sort({ category: 1, sort_order: 1 })
      .lean();
  },

  /**
   * Add a material to a guide.
   */
  async create(guideId: string, data: {
    name: string;
    quantity: number;
    unit: string;
    category: 'tool' | 'consumable' | 'component';
    part_number?: string;
  }) {
    const guide = await CabinetGuide.findById(guideId);
    if (!guide) {
      throw new NotFoundError('Guide not found');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Material name is required');
    }

    // Determine next sort_order
    const maxItem = await GuideMaterial.findOne({ guide_id: guideId })
      .sort({ sort_order: -1 })
      .select('sort_order');
    const sortOrder = maxItem ? maxItem.sort_order + 1 : 0;

    const material = await GuideMaterial.create({
      guide_id: new Types.ObjectId(guideId),
      name: data.name.trim(),
      quantity: data.quantity || 1,
      unit: data.unit || 'pcs',
      category: data.category,
      part_number: data.part_number?.trim() || undefined,
      sort_order: sortOrder,
    });

    return material;
  },

  /**
   * Update a material.
   */
  async update(materialId: string, data: Partial<{
    name: string;
    quantity: number;
    unit: string;
    category: 'tool' | 'consumable' | 'component';
    part_number: string;
    sort_order: number;
  }>) {
    const material = await GuideMaterial.findById(materialId);
    if (!material) {
      throw new NotFoundError('Material not found');
    }

    if (data.name !== undefined) material.name = data.name.trim();
    if (data.quantity !== undefined) material.quantity = data.quantity;
    if (data.unit !== undefined) material.unit = data.unit;
    if (data.category !== undefined) material.category = data.category;
    if (data.part_number !== undefined) material.part_number = data.part_number.trim() || undefined;
    if (data.sort_order !== undefined) material.sort_order = data.sort_order;

    await material.save();
    return material;
  },

  /**
   * Delete a material.
   */
  async delete(materialId: string) {
    const material = await GuideMaterial.findById(materialId);
    if (!material) {
      throw new NotFoundError('Material not found');
    }
    await GuideMaterial.deleteOne({ _id: materialId });
  },
};
