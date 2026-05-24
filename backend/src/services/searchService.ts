import { CabinetGuide, ICabinetGuide } from '../models/CabinetGuide';
import { SearchFilters } from '../types/filters';
import { ValidationError } from '../middleware/errorHandler';

const MAX_RESULTS = 50;
const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 200;

/**
 * Search service for full-text search across cabinet guides.
 * Uses MongoDB text index on title, description, drive_model, cabinet_type.
 */
export const searchService = {
  /**
   * Search guides using MongoDB text index with optional filters.
   *
   * - Text query (1-200 chars) searches across title, description, drive_model, cabinet_type
   * - Filters: cabinetType (exact), driveModel (regex, case-insensitive), tags ($in), status
   * - Workers only see published guides (status filter enforced)
   * - Results sorted by text relevance score descending (max 50)
   * - Filter-only queries (no text) sorted by updated_at descending
   * - Returns empty array for no matches
   *
   * Preconditions:
   * - MongoDB text index exists on title, description, drive_model, cabinet_type
   * - filters.tags if provided contains valid ObjectId strings
   *
   * Postconditions:
   * - Returns array of guides matching query and filters
   * - Results sorted by text relevance score (highest first) when query is provided
   * - Results sorted by updated_at descending when no query is provided
   * - Empty array returned if no matches (never throws for valid input)
   * - Maximum 50 results returned
   *
   * @param query - Optional text search query (1-200 chars)
   * @param filters - Optional search filters
   * @param userRole - Role of the requesting user ('admin' | 'worker')
   * @returns Array of matching guides sorted by relevance or updated_at
   * @throws ValidationError if query length is outside accepted range
   */
  async searchGuides(
    query?: string,
    filters?: SearchFilters,
    userRole?: 'admin' | 'worker'
  ): Promise<ICabinetGuide[]> {
    const appliedFilters = filters || {};
    const role = userRole || 'worker';

    // Validate query length if provided
    if (query !== undefined && query !== null && query !== '') {
      if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
        throw new ValidationError(
          'Query length is outside the accepted range (1-200 characters)',
          { query: 'Query must be between 1 and 200 characters' }
        );
      }
    }

    // Build the search query
    const searchQuery: Record<string, unknown> = {};
    const hasTextQuery = query !== undefined && query !== null && query.trim().length > 0;

    // Apply text search if query is provided
    if (hasTextQuery) {
      searchQuery.$text = { $search: query };
    }

    // Workers only see published guides
    if (role === 'worker') {
      searchQuery.status = 'published';
    } else if (appliedFilters.status) {
      searchQuery.status = appliedFilters.status;
    }

    // Apply filters
    if (appliedFilters.cabinetType) {
      searchQuery.cabinet_type = appliedFilters.cabinetType;
    }

    if (appliedFilters.driveModel) {
      searchQuery.drive_model = new RegExp(appliedFilters.driveModel, 'i');
    }

    if (appliedFilters.tags && appliedFilters.tags.length > 0) {
      searchQuery.tags = { $in: appliedFilters.tags };
    }

    // Execute query with appropriate sorting
    let queryBuilder = CabinetGuide.find(searchQuery);

    if (hasTextQuery) {
      // Sort by text relevance score descending
      queryBuilder = queryBuilder
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      // Filter-only queries sorted by updated_at descending
      queryBuilder = queryBuilder.sort({ updated_at: -1 });
    }

    const results = await queryBuilder
      .limit(MAX_RESULTS)
      .populate('tags', 'name')
      .populate('created_by', 'name email')
      .lean();

    return results as unknown as ICabinetGuide[];
  },
};
