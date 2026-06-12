# Requirements Document

## Introduction

WerkFlow is a web-based production knowledge platform for industrial electrical cabinet assembly. It enables experienced production workers (Admins) to create standardized, visual assembly guides for cabinet models — including VSD cabinets, industrial control cabinets, MCC sections, and custom electrical panels — so that other workers can follow them step-by-step during production. The platform uses a Vue 3 frontend, Express.js backend, MongoDB for data storage, and JWT-based authentication with role-based access control.

## Glossary

- **System**: The WerkFlow web application (frontend and backend combined)
- **Admin**: A user with the 'admin' role who can create, edit, publish, and delete guides
- **Worker**: A user with the 'worker' role who can view and follow published guides
- **Guide**: A CabinetGuide document representing a complete assembly guide for a cabinet model
- **Build_Step**: An ordered instruction step within a guide containing title, description, and optional media
- **Step_Media**: An image or PDF file attached to a build step
- **Auth_Module**: The authentication and authorization subsystem handling JWT tokens and role checks
- **Guide_Service**: The backend service responsible for guide CRUD operations and status transitions
- **Step_Service**: The backend service responsible for build step management and ordering
- **Upload_Service**: The backend service responsible for file upload validation, compression, and storage
- **Search_Service**: The backend service responsible for full-text search across guides
- **Slug**: A URL-friendly identifier generated from a guide title (lowercase, hyphenated, alphanumeric)

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in with my email and password, so that I can access the platform with my assigned role.

#### Acceptance Criteria

1. WHEN a user submits valid email and password credentials, THE Auth_Module SHALL return a JWT token and the user profile containing userId, name, email, and role
2. WHEN a user submits invalid credentials, THE Auth_Module SHALL return a 401 Unauthorized response with a generic error message indicating that the credentials are invalid, without revealing whether the email or password was incorrect
3. THE Auth_Module SHALL hash all passwords using bcrypt with a cost factor of 12 before storing them
4. WHEN a JWT token is issued, THE Auth_Module SHALL set the token expiration to 8 hours from the time of issuance
5. WHEN a request contains an expired, malformed, or tampered JWT token, THE Auth_Module SHALL return a 401 Unauthorized response
6. THE Auth_Module SHALL encode the userId and role in the JWT payload
7. IF a login request is missing the email or password field, THEN THE Auth_Module SHALL return a 400 Bad Request response with an error message indicating which required field is missing

### Requirement 2: Role-Based Access Control

**User Story:** As a system administrator, I want to restrict mutation operations to Admin users, so that Workers cannot modify production guides.

#### Acceptance Criteria

1. WHEN an authenticated Admin makes a create, update, or delete request to any resource (guides, build steps, step media, or tags), THE System SHALL allow the operation to proceed to the route handler
2. WHEN an authenticated Worker makes a create, update, or delete request to any resource, THE System SHALL return a 403 Forbidden response with an error message indicating insufficient permissions
3. WHEN a request without a valid JWT token is made to any API endpoint, THE System SHALL return a 401 Unauthorized response before processing the request
4. THE System SHALL enforce role checks on the server side regardless of frontend restrictions
5. WHILE a user is authenticated with the Worker role, THE System SHALL permit read-only access to published guides, build steps, and associated step media

### Requirement 3: Guide Creation and Editing

**User Story:** As an Admin, I want to create and edit cabinet assembly guides, so that I can document standardized assembly procedures.

#### Acceptance Criteria

1. WHEN an Admin submits a guide form with title, cabinet type, and description, THE Guide_Service SHALL create a new guide with status 'draft' and version 1
2. WHEN a guide is created, THE Guide_Service SHALL generate a unique slug from the title containing only lowercase letters, digits, and hyphens, with a maximum length of 200 characters
3. WHEN a generated slug already exists in the database, THE Guide_Service SHALL append a numeric suffix (e.g., -2, -3) to ensure uniqueness
4. WHEN an Admin updates a guide, THE Guide_Service SHALL update the 'updated_at' timestamp
5. THE Guide_Service SHALL validate that the title is between 3 and 200 characters
6. THE Guide_Service SHALL validate that the description does not exceed 5000 characters
7. THE Guide_Service SHALL require a cabinet_type value between 1 and 100 characters for every guide
8. IF a guide creation or update request fails validation, THEN THE Guide_Service SHALL return a validation error indicating which fields are invalid and leave the database unchanged
9. IF an Admin attempts to update a guide that does not exist, THEN THE Guide_Service SHALL return a not-found error

### Requirement 4: Guide Status Transitions

**User Story:** As an Admin, I want to publish, archive, and reopen guides, so that I can control which guides are visible to Workers.

#### Acceptance Criteria

1. THE Guide_Service SHALL only allow the following status transitions: draft to published, draft to archived, published to archived, archived to draft
2. IF an Admin attempts a status transition not listed in criterion 1, THEN THE Guide_Service SHALL return a validation error and leave the guide status, version, and all other fields unchanged
3. WHEN an Admin publishes a guide, THE Guide_Service SHALL verify the guide contains at least one build step and reject the transition with a validation error if the guide has zero build steps
4. WHEN a guide is published, THE Guide_Service SHALL increment the guide version number by exactly one from its current value
5. WHEN a guide transitions to any new status, THE Guide_Service SHALL update the 'updated_at' timestamp to the current server time
6. THE Guide_Service SHALL ensure the version number only increases and is never decremented, including across re-publish cycles where a guide transitions from archived to draft and back to published
7. WHEN a new guide is created, THE Guide_Service SHALL initialize the version number to 1

### Requirement 5: Build Step Management

**User Story:** As an Admin, I want to add, edit, reorder, and remove build steps within a guide, so that I can create detailed sequential assembly instructions.

#### Acceptance Criteria

1. WHEN an Admin adds a build step to a guide, THE Step_Service SHALL assign a step_order value equal to the current maximum step_order within that guide plus one, or 1 if the guide has no existing steps
2. WHEN an Admin provides a new ordering of step IDs, THE Step_Service SHALL update all step_order values to form a contiguous sequence from 1 to N where N is the total number of steps in the guide
3. WHEN an Admin reorders steps, THE Step_Service SHALL validate that the provided step IDs are an exact permutation of all steps in the guide and contain no duplicate IDs
4. WHEN a build step is deleted, THE Step_Service SHALL delete all associated Step_Media records and their files from the filesystem, and reassign step_order values of the remaining steps to form a contiguous sequence from 1 to N
5. IF a step title is shorter than 3 characters or longer than 200 characters, THEN THE Step_Service SHALL reject the request with a validation error indicating the title length constraint
6. THE Step_Service SHALL validate that step_order values are positive integers
7. IF a step reorder request contains step IDs not belonging to the specified guide, THEN THE Step_Service SHALL reject the request with a validation error and leave all step_order values unchanged
8. IF a step reorder request contains duplicate step IDs, THEN THE Step_Service SHALL reject the request with a validation error and leave all step_order values unchanged

### Requirement 6: File Upload and Storage

**User Story:** As an Admin, I want to upload images and PDFs to build steps, so that Workers can see visual references during assembly.

#### Acceptance Criteria

1. WHEN an Admin uploads an image file, THE Upload_Service SHALL validate that the MIME type is image/jpeg or image/png and reject the upload with a 400 error indicating the unsupported file type if validation fails
2. WHEN an Admin uploads a PDF file, THE Upload_Service SHALL validate that the MIME type is application/pdf and reject the upload with a 400 error indicating the unsupported file type if validation fails
3. IF an image file exceeds 10 MB, THEN THE Upload_Service SHALL reject the upload with a 400 error indicating the file exceeds the maximum allowed size of 10 MB
4. IF a PDF file exceeds 25 MB, THEN THE Upload_Service SHALL reject the upload with a 400 error indicating the file exceeds the maximum allowed size of 25 MB
5. WHEN a valid image is uploaded, THE Upload_Service SHALL compress it to JPEG quality 80 and resize to a maximum of 1920x1920 pixels while maintaining aspect ratio, without enlarging images that are already smaller than 1920x1920
6. THE Upload_Service SHALL generate a UUID-based filename for every uploaded file to prevent path traversal and filename collisions
7. IF a file upload fails due to a storage error, THEN THE Upload_Service SHALL remove any partial files from the filesystem and return a 500 error indicating a storage failure
8. THE Upload_Service SHALL store the file_type as 'image' only when the file extension is .jpg, .jpeg, or .png, and as 'pdf' only when the extension is .pdf
9. THE Upload_Service SHALL allow a maximum of 20 media files (images and PDFs combined) per build step

### Requirement 7: Guide Search

**User Story:** As a Worker, I want to search for cabinet guides by keyword, type, or drive model, so that I can quickly find the assembly instructions I need.

#### Acceptance Criteria

1. WHEN a Worker submits a search query of 1 to 200 characters, THE Search_Service SHALL perform a full-text search across guide title, description, drive model, and cabinet type fields
2. WHEN search results are returned, THE Search_Service SHALL sort them by text relevance score in descending order and return a maximum of 50 results
3. WHEN a Worker searches with filters and a text query, THE Search_Service SHALL return only guides matching the text query AND all specified filter criteria (cabinet type, drive model, and tags)
4. IF the requester is a Worker, THEN THE Search_Service SHALL exclude all guides with status other than 'published' from the results
5. WHEN a search query matches no guides, THE Search_Service SHALL return an empty array without error
6. WHEN a Worker submits a search request with filters but no text query, THE Search_Service SHALL return all published guides matching the specified filter criteria sorted by updated_at in descending order
7. IF a Worker submits a search query shorter than 1 character or longer than 200 characters, THEN THE Search_Service SHALL return a validation error indicating the query length is outside the accepted range

### Requirement 8: Guide Listing and Pagination

**User Story:** As a user, I want to browse guides in a paginated list, so that I can find guides without loading the entire collection.

#### Acceptance Criteria

1. WHEN a user requests the guide list without specifying pagination parameters, THE Guide_Service SHALL return the first page of results with a default page size of 20 guides, sorted by 'updated_at' descending
2. THE Guide_Service SHALL include total count, current page, and total pages in the paginated response, where total pages equals the ceiling of total count divided by the page size
3. WHEN a user specifies page and limit parameters, THE Guide_Service SHALL return the subset of guides corresponding to the requested page, where limit is between 1 and 100
4. IF the page parameter is less than 1 or the limit parameter is outside the range 1 to 100, THEN THE Guide_Service SHALL return a validation error indicating the invalid parameter
5. IF the requested page exceeds the total number of pages, THEN THE Guide_Service SHALL return an empty data array with the correct total count and total pages values
6. WHILE a Worker is browsing the guide list, THE Guide_Service SHALL return only guides with status 'published'

### Requirement 9: Guide Cascade Deletion

**User Story:** As an Admin, I want to delete a guide and have all associated data removed, so that no orphaned records or files remain.

#### Acceptance Criteria

1. WHEN an Admin deletes a guide, THE Guide_Service SHALL remove the corresponding files from the filesystem for all Step_Media records, then delete all Step_Media records, then delete all build steps, then delete the guide record itself
2. WHEN build steps are deleted as part of a guide deletion, THE System SHALL delete all Step_Media records associated with those steps before deleting the build step records
3. WHEN Step_Media records are deleted, THE System SHALL remove the corresponding files from the filesystem before removing the database records
4. IF a file cannot be removed from the filesystem during cascade deletion, THEN THE Guide_Service SHALL log the failure, continue deleting remaining files, and complete the guide deletion without leaving orphaned database records
5. IF the specified guide does not exist, THEN THE Guide_Service SHALL return a not-found error without modifying any data

### Requirement 10: Worker Guide Following

**User Story:** As a Worker, I want to follow a guide step-by-step and track my progress, so that I can complete cabinet assembly in the correct order.

#### Acceptance Criteria

1. WHEN a Worker opens a published guide, THE System SHALL display all build steps in ascending step_order sequence, showing each step's title, images, description, and warning notes
2. WHEN a Worker marks a step as complete, THE System SHALL persist the step's completion state to localStorage using a guide-specific key so that progress for different guides is stored independently
3. WHEN a Worker returns to a previously started guide, THE System SHALL restore their progress from localStorage and visually indicate which steps have been completed
4. IF the localStorage data for a guide is missing or cannot be parsed, THEN THE System SHALL treat the guide as having no completed steps and start progress from the beginning
5. WHEN a Worker is on the first step, THE System SHALL disable backward navigation, and WHEN a Worker is on the last step, THE System SHALL disable forward navigation
6. WHEN a Worker navigates between steps, THE System SHALL allow forward and backward navigation within the step sequence without requiring steps to be marked complete in order

### Requirement 11: Security Controls

**User Story:** As a system operator, I want the platform to enforce security best practices, so that user data and production content are protected.

#### Acceptance Criteria

1. IF login attempts from a single IP address exceed 5 within a 1-minute window, THEN THE System SHALL reject further login attempts with a 429 Too Many Requests response until the window resets
2. IF file upload requests from a single authenticated user exceed 10 within a 1-minute window, THEN THE System SHALL reject further uploads with a 429 Too Many Requests response until the window resets
3. WHEN a file is uploaded, THE System SHALL validate the file content by comparing magic bytes against the declared MIME type and reject the file with a 400 error indicating a file type mismatch if the magic bytes do not correspond to an allowed type (JPEG, PNG, or PDF)
4. THE System SHALL replace all user-provided filenames with UUID-generated names before storage
5. THE System SHALL validate all user input against Mongoose schema definitions before database writes, rejecting any request that fails schema validation with a 400 error indicating the invalid fields
6. WHILE the application is running in production mode, THE System SHALL restrict CORS to accept requests only from the configured frontend origin and reject cross-origin requests from all other origins

### Requirement 12: Data Validation

**User Story:** As a system operator, I want all data to be validated before storage, so that the database maintains integrity.

#### Acceptance Criteria

1. THE System SHALL validate that user email addresses are unique (case-insensitive), conform to standard email format (local-part@domain with valid domain), and do not exceed 254 characters
2. THE System SHALL require passwords to be between 8 and 128 characters long
3. IF a user role is not explicitly specified during user creation, THEN THE System SHALL default the role to 'worker'
4. THE System SHALL validate that tag names are unique in a case-insensitive manner and between 1 and 50 characters
5. THE System SHALL validate that warning_notes on build steps do not exceed 1000 characters
6. IF an estimated_time value is provided on a build step, THEN THE System SHALL validate that it is a positive number not exceeding 10080 (minutes in one week)
7. THE System SHALL validate that user names are between 2 and 100 characters long
8. IF any validation rule is violated, THEN THE System SHALL reject the request with a validation error indicating which field failed and the constraint that was violated, without persisting any data
