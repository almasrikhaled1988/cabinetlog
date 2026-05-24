# Implementation Plan: CabinetLog — Cabinet Assembly Platform

## Overview

Implement a full-stack web platform for industrial cabinet assembly guides using Vue 3 (frontend), Express.js/Node.js (backend), MongoDB (database), and Docker/Nginx (infrastructure). The implementation follows four phases: authentication and core structure, guide and step management with file uploads, search and filtering, and final integration with deployment configuration.

## Tasks

- [x] 1. Set up project structure, tooling, and core interfaces
  - [x] 1.1 Initialize monorepo with backend and frontend directories
    - Create root `package.json` with workspaces for `backend/` and `frontend/`
    - Initialize backend with Express, TypeScript, and dependencies (mongoose, jsonwebtoken, bcryptjs, multer, sharp, uuid, cors, helmet, express-rate-limit, dotenv)
    - Initialize frontend with Vue 3, Vite, TypeScript, Vue Router, Pinia, Axios, TailwindCSS, @vueuse/core
    - Set up ESLint and Prettier configs for both packages
    - Configure Jest for backend, Vitest for frontend, fast-check for property tests
    - _Requirements: All_

  - [x] 1.2 Define shared TypeScript interfaces and types
    - Create `backend/src/types/` with User, CabinetGuide, BuildStep, StepMedia, Tag interfaces
    - Create DTOs: CreateGuideDTO, UpdateGuideDTO, CreateStepDTO, UpdateStepDTO
    - Define AuthResponse, DecodedToken, PaginatedResult, ValidationResult types
    - Define GuideFilters, SearchFilters interfaces
    - Define FILE_CONSTRAINTS constants for image and PDF limits
    - _Requirements: 3.1, 5.1, 6.1, 6.2, 6.3, 6.4, 8.1_

  - [x] 1.3 Create Mongoose models and schemas
    - Implement User model with email uniqueness (case-insensitive), bcrypt password hashing, role enum
    - Implement CabinetGuide model with text index on title/description/drive_model/cabinet_type, unique slug index
    - Implement BuildStep model with compound index on (cabinet_guide_id, step_order)
    - Implement StepMedia model with build_step_id reference and sort_order
    - Implement Tag model with case-insensitive unique name
    - Add all validation rules from data model specifications
    - _Requirements: 3.2, 3.5, 3.6, 3.7, 5.5, 5.6, 6.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 1.4 Set up Express server with middleware stack
    - Configure Express app with JSON body parser, CORS, Helmet security headers
    - Set up environment variable loading with dotenv
    - Create error handling middleware with structured error responses
    - Set up MongoDB connection with Mongoose
    - Create route mounting structure for /api/auth, /api/guides, /api/upload, /api/tags
    - _Requirements: 11.5, 11.6_

- [x] 2. Implement authentication and authorization
  - [x] 2.1 Implement Auth service and login endpoint
    - Create `authService` with login, hashPassword, comparePassword, verifyToken methods
    - Implement POST /api/auth/login route: validate email/password fields, authenticate user, return JWT + user profile
    - JWT payload includes userId and role, expires in 8 hours
    - Return 401 with generic message for invalid credentials (don't reveal which field is wrong)
    - Return 400 for missing email or password fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7_

  - [x] 2.2 Implement auth middleware and role guard
    - Create `authMiddleware` that extracts JWT from Authorization header, verifies, attaches user to req
    - Return 401 for missing, expired, malformed, or tampered tokens
    - Create `requireRole(...roles)` factory middleware that checks req.user.role
    - Return 403 for insufficient permissions
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.3 Implement rate limiting for login endpoint
    - Configure express-rate-limit: 5 attempts per minute per IP on /api/auth/login
    - Return 429 Too Many Requests when limit exceeded
    - _Requirements: 11.1_

  - [ ]* 2.4 Write property tests for JWT token integrity
    - **Property 11: JWT Token Integrity** — verify issued tokens decode to correct userId/role with 8h expiry
    - **Property 12: Invalid Token Rejection** — verify expired/malformed/tampered tokens are rejected with 401
    - **Validates: Requirements 1.4, 1.5, 1.6, 2.3**

  - [ ]* 2.5 Write property test for password hashing
    - **Property 20: Password Hashing** — verify passwords are stored as bcrypt hashes and comparison succeeds for original password
    - **Validates: Requirements 1.3**

  - [ ]* 2.6 Write property test for role authorization
    - **Property 6: Role Authorization** — verify admin role allows mutations, worker role gets 403 on all mutation endpoints
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Checkpoint - Authentication complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement guide CRUD and status management
  - [x] 4.1 Implement Guide service with CRUD operations
    - Create `guideService` with createGuide, getGuides, getGuideById, updateGuide, deleteGuide methods
    - Implement slug generation: lowercase, alphanumeric + hyphens, max 200 chars, append -2/-3 for duplicates
    - Validate title (3-200 chars), description (max 5000 chars), cabinet_type (1-100 chars)
    - Set status to 'draft' and version to 1 on creation
    - Update `updated_at` on every modification
    - Return validation errors for invalid fields; return 404 for non-existent guides
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.7_

  - [x] 4.2 Implement guide status transitions
    - Implement `transitionGuideStatus` with valid transitions: draft→published, draft→archived, published→archived, archived→draft
    - Reject invalid transitions with validation error, leaving guide unchanged
    - On publish: verify at least 1 build step exists, increment version by 1
    - Ensure version never decreases across any transition sequence
    - Update `updated_at` on every status change
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.3 Implement guide REST endpoints
    - POST /api/guides — create guide (admin only)
    - GET /api/guides — list guides with pagination and filters
    - GET /api/guides/:id — get single guide with populated steps
    - PUT /api/guides/:id — update guide (admin only)
    - PUT /api/guides/:id/status — transition status (admin only)
    - DELETE /api/guides/:id — delete guide with cascade (admin only)
    - Workers see only published guides on list/search endpoints
    - _Requirements: 2.1, 2.2, 3.1, 4.1, 8.6_

  - [ ]* 4.4 Write property tests for guide status transitions
    - **Property 1: Guide Status Transition Integrity** — only valid transitions succeed, invalid ones leave guide unchanged
    - **Property 2: Published Guide Non-Empty** — publishing requires ≥1 step, version increments by 1
    - **Property 3: Version Monotonicity** — version only increases across any operation sequence
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**

  - [ ]* 4.5 Write property tests for slug generation
    - **Property 9: Slug Validity and Uniqueness** — slugs contain only a-z, 0-9, hyphens; unique across all guides with numeric suffix appended when needed
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [ ]* 4.6 Write property test for title length validation
    - **Property 18: Title Length Validation** — strings <3 or >200 chars rejected as invalid titles by Guide_Service and Step_Service
    - **Validates: Requirements 3.6, 5.5**

- [x] 5. Implement guide listing and pagination
  - [x] 5.1 Implement paginated guide listing
    - Default page size 20, sorted by updated_at descending
    - Accept page (≥1) and limit (1-100) query parameters
    - Return PaginatedResult with data, total, page, totalPages (ceil(total/limit))
    - Return empty data array with correct totals when page exceeds total pages
    - Return validation error for invalid page/limit values
    - Workers see only published guides
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 5.2 Write property test for pagination consistency
    - **Property 19: Pagination Consistency** — totalPages = ceil(total/limit), returned data corresponds to requested page
    - **Validates: Requirements 8.2, 8.3**

- [x] 6. Implement build step management
  - [x] 6.1 Implement Step service
    - Create `stepService` with createStep, updateStep, deleteStep, reorderSteps, getStepsByGuide methods
    - Auto-assign step_order on creation (max existing + 1, or 1 if first step)
    - Validate title (3-200 chars), step_order (positive integer), warning_notes (max 1000 chars), estimated_time (positive, max 10080)
    - On delete: remove associated StepMedia records and files, reassign step_order to contiguous 1..N
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 12.5, 12.6_

  - [x] 6.2 Implement step reordering logic
    - Accept array of step IDs representing new order
    - Validate: all IDs belong to the guide, no duplicates, exact permutation of all steps
    - Use bulkWrite to atomically update step_order values to contiguous 1..N
    - Reject with validation error if validation fails, leaving step_order unchanged
    - _Requirements: 5.2, 5.3, 5.7, 5.8_

  - [x] 6.3 Implement step REST endpoints
    - POST /api/guides/:guideId/steps — create step (admin only)
    - PUT /api/steps/:id — update step (admin only)
    - DELETE /api/steps/:id — delete step with media cascade (admin only)
    - PUT /api/guides/:guideId/steps/reorder — reorder steps (admin only)
    - GET /api/guides/:guideId/steps — get steps for guide (sorted by step_order)
    - _Requirements: 2.1, 5.1, 5.2, 5.3_

  - [ ]* 6.4 Write property tests for step reordering
    - **Property 4: Step Order Contiguity After Reorder** — any valid permutation produces contiguous [1..N] step_order values
    - **Property 5: Step Reorder Validation** — invalid permutations (missing/extra/foreign IDs) are rejected, step_order unchanged
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.7**

- [x] 7. Checkpoint - Guide and step management complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement file upload service
  - [x] 8.1 Implement file validation and upload logic
    - Create `uploadService` with uploadImage, uploadPDF, deleteFile, validateFile, compressImage methods
    - Validate MIME type (image/jpeg, image/png for images; application/pdf for PDFs)
    - Validate file size (10MB images, 25MB PDFs)
    - Validate magic bytes match declared MIME type
    - Generate UUID-based filenames, organize in date-based directories
    - Compress images with sharp: resize max 1920x1920 (fit inside, no enlargement), JPEG quality 80
    - Clean up partial files on storage failure
    - Enforce max 20 media files per build step
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 11.3, 11.4_

  - [x] 8.2 Implement upload REST endpoints and rate limiting
    - POST /api/upload/image — upload image (admin only, multer middleware)
    - POST /api/upload/pdf — upload PDF (admin only, multer middleware)
    - DELETE /api/upload/:id — delete media file (admin only)
    - Configure rate limit: 10 uploads per minute per user
    - _Requirements: 2.1, 6.1, 6.2, 11.2_

  - [ ]* 8.3 Write property tests for file validation
    - **Property 7: File Validation** — rejects files with invalid MIME type or exceeding size limits
    - **Property 8: File Type Consistency** — file_type matches file extension (image ↔ .jpg/.jpeg/.png, pdf ↔ .pdf)
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.8**

  - [ ]* 8.4 Write property tests for image compression and filename
    - **Property 15: Image Compression Bounds** — output ≤1920x1920, aspect ratio maintained, no enlargement
    - **Property 16: UUID Filename Generation** — stored filenames are UUID-based, no path traversal possible
    - **Validates: Requirements 6.5, 6.6, 11.4**

- [x] 9. Implement search and tag management
  - [x] 9.1 Implement search service
    - Create `searchService` with searchGuides method using MongoDB text index
    - Support text query (1-200 chars) across title, description, drive_model, cabinet_type
    - Apply filters: cabinetType, driveModel (regex), tags ($in), status
    - Sort by text relevance score descending, max 50 results
    - Workers only see published guides
    - Return empty array for no matches; validate query length
    - Support filter-only queries (no text) sorted by updated_at descending
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 9.2 Implement search and tag REST endpoints
    - GET /api/guides/search — search guides with query and filters
    - POST /api/tags — create tag (admin only)
    - GET /api/tags — list all tags
    - DELETE /api/tags/:id — delete tag (admin only)
    - _Requirements: 7.1, 12.4_

  - [ ]* 9.3 Write property tests for search filtering
    - **Property 13: Search Result Filtering for Workers** — worker search results contain only published guides
    - **Property 14: Search Result Relevance Ordering** — results sorted by relevance score in non-increasing order
    - **Validates: Requirements 7.2, 7.4**

- [x] 10. Implement cascade deletion
  - [x] 10.1 Implement guide cascade deletion logic
    - On guide delete: remove all filesystem files for StepMedia → delete StepMedia records → delete BuildStep records → delete Guide record
    - Log filesystem errors but continue deletion (don't leave orphaned DB records)
    - Return 404 for non-existent guides
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 10.2 Write property test for cascade deletion
    - **Property 10: Cascade Deletion** — after guide deletion, no associated steps, media records, or files remain
    - **Validates: Requirements 9.1, 9.2, 9.3, 5.4**

- [x] 11. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Vue 3 frontend - Authentication and layout
  - [x] 12.1 Set up Vue Router and layout components
    - Configure routes: /login, /dashboard, /guides, /guides/:id, /guides/:id/edit, /guides/:id/steps/:stepId
    - Create AppLayout with navigation header (logo, nav links, user menu, logout)
    - Implement route guards: redirect unauthenticated users to /login, restrict admin routes
    - Create responsive layout with TailwindCSS (mobile-first for shop floor use)
    - _Requirements: 2.4, 2.5, 10.1_

  - [x] 12.2 Implement Pinia auth store and login page
    - Create auth store with login action, token storage, user state, logout
    - Configure Axios interceptor: attach JWT to requests, handle 401 → redirect to login
    - Build login page with email/password form, validation, error display
    - Persist token in localStorage, restore on app load
    - _Requirements: 1.1, 1.2, 1.7_

- [x] 13. Implement Vue 3 frontend - Guide management
  - [x] 13.1 Build guide list page with pagination
    - Create GuidesListPage with paginated grid/list of guide cards
    - Show title, cabinet type, drive model, status badge, thumbnail
    - Implement pagination controls (page navigation, items per page selector)
    - Add search bar and filter dropdowns (cabinet type, tags)
    - Workers see only published guides; Admins see all with status filters
    - _Requirements: 8.1, 8.2, 8.3, 7.1, 7.3_

  - [x] 13.2 Build guide create/edit form
    - Create GuideFormPage with fields: title, cabinet_type, drive_model, description, tags
    - Implement client-side validation matching backend rules
    - Auto-save with 2-second debounce using @vueuse/core
    - Show status badge and publish/archive action buttons for admins
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 4.1_

  - [x] 13.3 Build guide detail page
    - Create GuideDetailPage showing guide info and step list
    - Admin view: edit button, step management (add/reorder/delete), status controls
    - Worker view: step-by-step navigation with large images and instructions
    - _Requirements: 10.1, 4.1_

- [x] 14. Implement Vue 3 frontend - Build steps and file upload
  - [x] 14.1 Build step editor component
    - Create StepEditor with title, description, estimated_time, warning_notes fields
    - Implement drag-and-drop step reordering (call reorder API on drop)
    - Add/remove steps with proper order management
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 14.2 Build file upload component
    - Create ImageUploader with drag-and-drop and file picker
    - Show upload progress, preview thumbnails, captions
    - Client-side validation: file type (JPEG/PNG/PDF), size limits
    - Display uploaded media gallery per step with delete option
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.9_

  - [x] 14.3 Implement worker step-following experience
    - Create StepFollowView with large image display, step navigation (prev/next)
    - Implement progress tracking with localStorage (guide-specific keys)
    - Restore progress on return; show completed step indicators
    - Disable backward nav on first step, forward nav on last step
    - Allow free navigation without requiring sequential completion
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 14.4 Write property test for progress persistence
    - **Property 17: Progress Persistence Round-Trip** — saved step completion state in localStorage is exactly restored on return
    - **Validates: Requirements 10.2, 10.3**

- [x] 15. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Integration, deployment configuration, and final wiring
  - [x] 16.1 Write backend integration tests
    - Test full guide lifecycle: create → add steps → upload media → publish → archive
    - Test authentication flow: login → access protected route → expired token → re-login
    - Test cascade deletion: delete guide → verify steps/media/files removed
    - Test search: create guides → verify search returns correct results with filters
    - Use Supertest + mongodb-memory-server
    - _Requirements: All_

  - [x] 16.2 Configure Docker and Nginx deployment
    - Create Dockerfile for backend (Node.js)
    - Create Dockerfile for frontend (build Vue app, serve with Nginx)
    - Create docker-compose.yml with services: frontend, backend, mongodb, nginx
    - Configure Nginx as reverse proxy: /api/* → backend, static files → frontend, /uploads/* → file storage
    - Set up environment variables for production (JWT_SECRET, MONGODB_URI, CORS_ORIGIN)
    - _Requirements: 11.6_

  - [x] 16.3 Create seed script and initial admin user setup
    - Create database seed script for initial admin user
    - Create script for MongoDB index creation (text index, unique indexes)
    - Document environment setup in README
    - _Requirements: 12.3_

- [x] 17. Final checkpoint - Full platform integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend uses Jest + Supertest + mongodb-memory-server for testing
- Frontend uses Vitest for unit/component tests
- fast-check is used for property-based testing on both backend and frontend
- TypeScript is used throughout (backend and frontend)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "4.6", "5.1"] },
    { "id": 6, "tasks": ["5.2", "6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 10, "tasks": ["9.1", "9.2"] },
    { "id": 11, "tasks": ["9.3", "10.1"] },
    { "id": 12, "tasks": ["10.2"] },
    { "id": 13, "tasks": ["12.1", "12.2"] },
    { "id": 14, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 15, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 16, "tasks": ["14.4"] },
    { "id": 17, "tasks": ["16.1", "16.2", "16.3"] }
  ]
}
```
