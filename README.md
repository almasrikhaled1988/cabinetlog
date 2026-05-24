# CabinetLog — Cabinet Assembly Platform

A web-based production knowledge platform for industrial electrical cabinet assembly. Experienced production workers (Admins) create standardized, visual assembly guides for cabinet models so that other workers can follow them step-by-step during production.

## Tech Stack

- **Frontend**: Vue 3, Vite, TypeScript, Vue Router, Pinia, TailwindCSS
- **Backend**: Node.js, Express.js, TypeScript, Mongoose
- **Database**: MongoDB
- **Authentication**: JWT with role-based access control (Admin / Worker)
- **File Storage**: Local filesystem with image compression (Sharp)
- **Infrastructure**: Docker, Nginx reverse proxy

## Project Structure

```
├── backend/             # Express.js API server
│   ├── src/
│   │   ├── config/      # Database connection
│   │   ├── controllers/ # Route handlers
│   │   ├── middleware/  # Auth, error handling, rate limiting
│   │   ├── models/      # Mongoose schemas
│   │   ├── routes/      # Express route definitions
│   │   ├── scripts/     # Seed and maintenance scripts
│   │   ├── services/    # Business logic
│   │   └── types/       # TypeScript interfaces and DTOs
│   └── package.json
├── frontend/            # Vue 3 SPA
│   ├── src/
│   │   ├── api/         # Axios HTTP client
│   │   ├── components/  # Reusable Vue components
│   │   ├── composables/ # Vue composables
│   │   ├── pages/       # Page/view components
│   │   ├── router/      # Vue Router config
│   │   ├── stores/      # Pinia state stores
│   │   └── types/       # TypeScript types
│   └── package.json
├── docker-compose.yml   # Multi-container deployment
└── README.md
```

## Prerequisites

- Node.js >= 18
- MongoDB >= 6.0 (or use Docker)
- npm >= 9

## Environment Variables

Create a `.env` file in the `backend/` directory based on `.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/cabinetlog` |
| `JWT_SECRET` | Secret key for signing JWT tokens | *(required, change in production)* |
| `CORS_ORIGIN` | Allowed frontend origin for CORS | `http://localhost:3000` |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

## Getting Started

### Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Start MongoDB

Using Docker:
```bash
docker run -d --name cabinetlog-mongo -p 27017:27017 mongo:7
```

Or start your local MongoDB instance.

### Seed the Database

Create the initial admin user and ensure all database indexes are set up:

```bash
cd backend
npm run seed
```

This creates:
- **Admin user**: `admin@cabinetlog.local` / `changeme123`
- All MongoDB indexes (text search, unique constraints, compound indexes)

> ⚠️ Change the admin password immediately after first login in production.

### Create Indexes Only

If you only need to sync indexes without seeding data:

```bash
cd backend
npm run db:indexes
```

### Run Development Servers

```bash
# Terminal 1 — Backend (port 4000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

The frontend dev server runs at `http://localhost:5173` and proxies API requests to the backend.

### Run Tests

```bash
# Backend tests (Jest)
cd backend
npm test

# Frontend tests (Vitest)
cd frontend
npm test
```

## Production Build

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
# Serve the dist/ directory with Nginx or any static file server
```

### Docker Compose

```bash
docker-compose up -d
```

This starts all services:
- **frontend** — Vue 3 SPA served by Nginx
- **backend** — Express.js API
- **mongodb** — MongoDB database
- **nginx** — Reverse proxy routing `/api/*` to backend, static assets to frontend

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Authenticate user |
| GET | `/api/guides` | Token | List guides (paginated) |
| POST | `/api/guides` | Admin | Create guide |
| GET | `/api/guides/:id` | Token | Get guide detail |
| PUT | `/api/guides/:id` | Admin | Update guide |
| PUT | `/api/guides/:id/status` | Admin | Transition guide status |
| DELETE | `/api/guides/:id` | Admin | Delete guide (cascade) |
| GET | `/api/guides/search` | Token | Search guides |
| POST | `/api/guides/:guideId/steps` | Admin | Add build step |
| PUT | `/api/steps/:id` | Admin | Update step |
| DELETE | `/api/steps/:id` | Admin | Delete step |
| PUT | `/api/guides/:guideId/steps/reorder` | Admin | Reorder steps |
| POST | `/api/upload/image` | Admin | Upload image |
| POST | `/api/upload/pdf` | Admin | Upload PDF |
| DELETE | `/api/upload/:id` | Admin | Delete media |
| GET | `/api/tags` | Token | List tags |
| POST | `/api/tags` | Admin | Create tag |
| DELETE | `/api/tags/:id` | Admin | Delete tag |

## Roles

- **Admin**: Full access — create, edit, publish, archive, and delete guides and steps
- **Worker**: Read-only access to published guides, step-by-step following with progress tracking

## Database Indexes

The following indexes are created by the seed/index scripts:

| Collection | Index | Type |
|------------|-------|------|
| users | email | Unique (case-insensitive) |
| cabinetguides | slug | Unique |
| cabinetguides | title, description, drive_model, cabinet_type | Text (weighted) |
| cabinetguides | status + updated_at | Compound |
| buildsteps | cabinet_guide_id + step_order | Unique compound |
| stepmedia | build_step_id + sort_order | Compound |
| tags | name | Unique (case-insensitive) |

## License

Private — Internal use only.
