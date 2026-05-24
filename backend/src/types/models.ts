import { Types } from 'mongoose';

export interface User {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'worker';
  created_at: Date;
}

export type UserPublic = Omit<User, 'password_hash'>;

export interface CabinetGuide {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  cabinet_type: string;
  drive_model: string;
  description: string;
  thumbnail_image?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  tags: Types.ObjectId[];
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

export interface BuildStep {
  _id: Types.ObjectId;
  cabinet_guide_id: Types.ObjectId;
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
  created_at: Date;
}

export interface StepMedia {
  _id: Types.ObjectId;
  build_step_id: Types.ObjectId;
  file_type: 'image' | 'pdf';
  file_path: string;
  original_name: string;
  file_size: number;
  caption?: string;
  sort_order: number;
  created_at: Date;
}

export interface Tag {
  _id: Types.ObjectId;
  name: string;
  created_at: Date;
}
