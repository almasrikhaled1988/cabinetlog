export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
