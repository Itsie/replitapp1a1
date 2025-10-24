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

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript with ES modules
- **API Style**: RESTful JSON API
- **Middleware**: CORS, cookie-parser, JSON body parsing

**API Structure:**
The backend exposes a RESTful API with the following key endpoints:

- `GET /api/health` - Health check endpoint
- `GET /api/orders` - List orders with filtering (query, department, source, workflow)
- `POST /api/orders` - Create new internal orders
- `GET /api/orders/:id` - Get order details with relations
- `POST /api/orders/:id/size` - Create/update size table
- `POST /api/orders/:id/assets` - Add print assets
- `POST /api/orders/:id/submit` - Validate and submit order for production

**Business Logic:**
- Internal orders default to source=INTERNAL and workflow=NEU
- JTL-sourced orders are read-only except for size/assets/location
- Order submission requires at least one required print asset (HTTP 412 if missing)
- Validation layer using Zod schemas for type safety

### Data Storage Solutions

**Database Configuration:**
- **Development**: SQLite (file-based, located at `prisma/dev.db`)
- **Production**: PostgreSQL via Neon serverless driver
- **ORM**: Prisma Client for type-safe database access
- **Migration Tool**: Drizzle Kit configured for PostgreSQL migrations

**Database Schema Highlights:**
- **User**: Authentication with roles (ADMIN, DISPO, PRODUKTION, LAGER, ABRECHNUNG)
- **Order**: Core entity with workflow states, sources (JTL/INTERNAL), departments
- **SizeTable**: JSON-based size/quantity data with flexible schemes (ALPHA/NUMERIC/CUSTOM)
- **PrintAsset**: File metadata with required flag for production validation
- **InvoiceQueueItem**: Billing queue for non-JTL orders
- Additional models: WorkCenter, Slot, JTLRow (for future implementation)

**Enum Types:**
- OrderSource: JTL | INTERNAL
- Department: TEAMSPORT | TEXTILVEREDELUNG | STICKEREI | DRUCK | SONSTIGES
- WorkflowState: ENTWURF | NEU | PRUEFUNG | FUER_PROD | IN_PROD | WARTET_FEHLTEILE | FERTIG | ZUR_ABRECHNUNG | ABGERECHNET
- QCState: IO | NIO | UNGEPRUEFT

### Authentication & Authorization

**Current Implementation:**
- JWT tokens stored in HttpOnly cookies for session management
- Role-based access control (planned, not fully implemented in current code)
- Simple authentication mechanism suitable for internal enterprise use

**Planned Security Features:**
- Backend role validation for protected endpoints
- Department-based data access restrictions
- Production-only vs admin-level permissions

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