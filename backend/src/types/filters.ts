export interface GuideFilters {
  search?: string;
  cabinetType?: string;
  driveModel?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  page?: number;
  limit?: number;
}

export interface SearchFilters {
  cabinetType?: string;
  driveModel?: string;
  tags?: string[];
  status?: 'published';
}
