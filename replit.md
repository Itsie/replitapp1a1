# 1aShirt Production & Order Management System

## Overview

1aShirt is a production and order management system designed for textile manufacturing and customization businesses. The system handles order intake from multiple sources (JTL e-commerce and internal departments), manages production workflows across different work centers, tracks size tables and print assets, and facilitates invoicing and billing operations.

The application is built as a monorepo with a Node.js/Express backend and React/Vite frontend, designed to run on Replit with development and production deployment capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system

**Design Philosophy:**
The application follows a "Design System-Inspired" approach prioritizing productivity and data clarity over decoration. It takes inspiration from Linear (clean data-first aesthetic) and Notion (flexible content organization) to create an efficient enterprise workflow tool.

**Key Frontend Patterns:**
- Form handling with react-hook-form and Zod validation
- Debounced search with 300ms delay for optimized API calls
- Card-based layouts for order lists and detail views
- Tab-based navigation for order details (Details, Sizes, Print Assets, History)
- Toast notifications for user feedback
- Modal dialogs for data entry (size tables, print assets)
- Real-time cache synchronization using `refetchQueries` for immediate UI updates after mutations

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript with ES modules
- **API Style**: RESTful JSON API
- **Middleware**: CORS, cookie-parser, JSON body parsing

**API Structure:**
The backend exposes a RESTful API with the following key endpoints:

**Order Management:**
- `GET /api/health` - Health check endpoint
- `GET /api/orders` - List orders with filtering (query, department, source, workflow)
- `POST /api/orders` - Create new internal orders
- `GET /api/orders/:id` - Get order details with relations
- `POST /api/orders/:id/size` - Create/update size table
- `POST /api/orders/:id/assets` - Add print assets
- `POST /api/orders/:id/submit` - Validate and submit order for production

**Production Planning & Execution:**
- `GET /api/calendar` - Get time slots with embedded workCenter and order data, supports date range and department filters
- `GET /api/workcenters` - List Bereiche (work centers) with optional filtering
- `POST /api/workcenters` - Create new Bereich with concurrentCapacity configuration
- `POST /api/timeslots` - Create new time slot with capacity-aware validation (returns 422 if capacity exceeded)
- `POST /api/timeslots/:id/start` - Start time slot execution (PLANNED/PAUSED → RUNNING)
- `POST /api/timeslots/:id/pause` - Pause running time slot (RUNNING → PAUSED)
- `POST /api/timeslots/:id/stop` - Stop time slot execution (RUNNING/PAUSED → DONE)
- `POST /api/timeslots/:id/qc` - Set quality control result (requires DONE status)
- `POST /api/timeslots/:id/missing-parts` - Report missing parts (requires DONE status)

**Business Logic:**
- Internal orders default to source=INTERNAL and workflow=NEU
- JTL-sourced orders are read-only except for size/assets/location
- Order submission requires at least one required print asset (HTTP 412 if missing)
- TimeSlot state machine enforces valid transitions with 422 errors for invalid state changes
- Missing parts reporting can optionally escalate order workflow to WARTET_FEHLTEILE
- Validation layer using Zod schemas for type safety

**Capacity-Based Scheduling:**
- Bereiche (WorkCenters) support concurrent capacity configuration (default: 2 parallel slots)
- Regular TimeSlots occupy 1 capacity unit; blockers occupy full capacity
- 5-minute time grid enforcement (07:00-18:00 working hours)
- Capacity validation at API layer returns HTTP 422 for capacity exceeded errors
- Planning UI renders parallel lanes based on concurrentCapacity
- Department matching enforced between Orders and WorkCenters

### Data Storage Solutions

**Database Configuration:**
- **Development**: SQLite (file-based, located at `prisma/dev.db`)
- **Production**: PostgreSQL via Neon serverless driver
- **ORM**: Prisma Client for type-safe database access
- **Migration Tool**: Drizzle Kit configured for PostgreSQL migrations

**Database Schema Highlights:**
- **User**: Authentication with roles (ADMIN, PROD_PLAN, PROD_RUN, SALES_OPS, ACCOUNTING)
- **Order**: Core entity with workflow states, sources (JTL/INTERNAL), departments
- **SizeTable**: JSON-based size/quantity data with flexible schemes (ALPHA/NUMERIC/CUSTOM)
- **PrintAsset**: File metadata with required flag for production validation
- **InvoiceQueueItem**: Billing queue for non-JTL orders
- **WorkCenter**: Production work centers with department assignment and capacity
- **TimeSlot**: Scheduling slots with execution tracking (status, startedAt, stoppedAt, qc, missingPartsNote)
- Additional models: JTLRow (for future implementation)

**Enum Types:**
- Role: ADMIN | PROD_PLAN | PROD_RUN | SALES_OPS | ACCOUNTING
- OrderSource: JTL | INTERNAL
- Department: TEAMSPORT | TEXTILVEREDELUNG | STICKEREI | DRUCK | SONSTIGES
- WorkflowState: ENTWURF | NEU | PRUEFUNG | FUER_PROD | IN_PROD | WARTET_FEHLTEILE | FERTIG | ZUR_ABRECHNUNG | ABGERECHNET
- QCState: IO | NIO | UNGEPRUEFT
- TimeSlotStatus: PLANNED | RUNNING | PAUSED | DONE | BLOCKED

### Authentication & Authorization

**Current Implementation (Development Mode):**
- Mock authentication via `X-User-Email` header for development
- Role-Based Access Control (RBAC) fully implemented with 5 roles:
  - **ADMIN**: Full access to all features (orders, planning, production, accounting, warehouse, settings)
  - **PROD_PLAN**: Planning access only (timeslots, calendar, work centers)
  - **PROD_RUN**: Production execution only (start/pause/stop operations)
  - **SALES_OPS**: Orders management only (create/edit orders)
  - **ACCOUNTING**: Billing and accounting access only
- Demo users available for each role (see prisma/seed.ts)
- Frontend UserContext provides current user state and role checks
- Navigation sidebar automatically filtered based on user role

**Backend Security:**
- `requireAuth` middleware: Protects all endpoints, requires authenticated user (returns 401 if missing)
- `requireRole` middleware: Enforces role-based access for write operations (returns 403 if unauthorized)
- All GET endpoints require authentication
- State-changing endpoints (POST/PUT/DELETE) require specific roles:
  - Orders CRUD: ADMIN or SALES_OPS
  - Planning/TimeSlots: ADMIN or PROD_PLAN
  - Production execution: ADMIN or PROD_RUN
  - Work centers: ADMIN or PROD_PLAN

**Frontend Security:**
- UserContext fetches current user from `/api/me` endpoint
- Query client automatically injects `X-User-Email` header to all API requests
- Navigation filtering prevents unauthorized page access
- User switcher dropdown for development testing (should be gated behind dev flag in production)

**Production Requirements:**
- Replace header-based authentication with proper session management or JWT
- Implement password hashing (currently plaintext in seed data)
- Remove or gate user-switcher behind environment flag
- Consider implementing refresh token rotation
- Add audit logging for sensitive operations

## External Dependencies

### Third-Party Services

**Planned Integrations (Not Yet Implemented):**
- **JTL Wawi**: E-commerce order import via CSV with variant support, discounts, taxes, and idempotent processing
- **Sevdesk**: Accounting/billing export via CSV format
- **File Storage**: Local filesystem (MVP), with planned migration to AWS S3 for production

### NPM Packages

**Core Dependencies:**
- `@prisma/client` - Database ORM
- `@neondatabase/serverless` - PostgreSQL serverless driver
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `cookie-parser` - Cookie handling middleware
- `zod` - Runtime type validation
- `@tanstack/react-query` - Server state management
- `react-hook-form` - Form state management
- `@hookform/resolvers` - Form validation integration
- `wouter` - Client-side routing

**UI Component Libraries:**
- `@radix-ui/*` - Headless UI primitives (20+ components)
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` - Component variant styling
- `cmdk` - Command palette primitives

**Development Tools:**
- `tsx` - TypeScript execution for Node.js
- `vite` - Build tool and dev server
- `concurrently` - Parallel script execution
- `drizzle-kit` - Database migrations
- `esbuild` - Production bundling

### Database Provider

**Development**: SQLite (embedded, no external service)
**Production**: Neon PostgreSQL (serverless PostgreSQL provider)
- Connection via `DATABASE_URL` environment variable
- Configured in `drizzle.config.ts`

### Build & Deployment

**Development Mode:**
- Concurrent frontend (Vite on port 5173) and backend (Express on port 3000)
- Hot module replacement for frontend
- TypeScript transpilation with `tsx`

**Production Build:**
- Frontend: Vite builds to `dist/public`
- Backend: esbuild bundles to `dist/index.js`
- Single Node.js process serves both static files and API

**Platform**: Optimized for Replit deployment with environment-specific plugins and configuration