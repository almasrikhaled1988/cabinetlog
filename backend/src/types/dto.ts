export interface CreateGuideDTO {
  title: string;
  cabinet_type: string;
  drive_model: string;
  description: string;
  thumbnail_image?: string;
  tags?: string[];
  is_template?: boolean;
}

export interface UpdateGuideDTO {
  title?: string;
  cabinet_type?: string;
  drive_model?: string;
  description?: string;
  thumbnail_image?: string;
  tags?: string[];
  is_template?: boolean;
}

export interface ChecklistItemDTO {
  text: string;
  required: boolean;
}

export interface CreateStepDTO {
  title: string;
  description: string;
  step_order: number;
  estimated_time?: number;
  warning_notes?: string;
  checklist_items?: ChecklistItemDTO[];
}

export interface UpdateStepDTO {
  title?: string;
  description?: string;
  step_order?: number;
  estimated_time?: number;
  warning_notes?: string;
  checklist_items?: ChecklistItemDTO[];
}
