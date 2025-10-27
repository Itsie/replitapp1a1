# 1aShirt Production & Order Management System

## Overview
1aShirt is a production and order management system for textile manufacturing and customization businesses. It manages order intake from various sources (JTL e-commerce and internal departments), orchestrates production workflows across different work centers, tracks size tables and print assets, and handles invoicing. The system aims to be an efficient enterprise workflow tool, inspired by the clean, data-first aesthetics of applications like Linear and Notion. It is built as a monorepo with a Node.js/Express backend and React/Vite frontend, designed for Replit deployment.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
**Technology Stack:** React 18 (TypeScript), Vite, Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS.
**Design Philosophy:** Design System-Inspired, prioritizing productivity and data clarity, drawing inspiration from Linear and Notion.
**Key Patterns:** React Hook Form with Zod validation, debounced search, card-based layouts, tab-based navigation, toast notifications, modal dialogs, real-time cache synchronization.
**Production View Design:** Vertical timeline layout (07:00-18:00) with proportional positioning, 30-minute grid markers, neutral color palette with status accents, per-cluster lane calculation for overlaps, compact mode for short slots, collapsible action controls, live tracking, and date navigation.
**Status & Hints System:** Modernized single-badge system displaying exactly ONE workflow status badge per order. Additional information (missing data, overdue status) appears as text in dedicated "Hinweise" column/section. German-language hints include: "Druckdaten fehlen", "Größentabelle fehlt", "Überfällig seit <date>", "Heute fällig". ABGERECHNET orders hidden by default with toggle to show/hide. Dark mode optimized.

### Backend Architecture
**Technology Stack:** Node.js 20, Express.js, TypeScript (ES modules), RESTful JSON API.
**API Structure:**
- **Order Management:** CRUD for internal orders, fetching JTL orders, managing size tables and print assets, order submission with validation.
- **Production Planning & Execution:** Calendar views, work center management, time slot creation with capacity validation, time slot state transitions (start, pause, stop), quality control, and missing parts reporting.
- **Warehouse Management:** Listing and managing warehouse places, viewing contents.
**Business Logic:** Internal orders default to `INTERNAL` source and `NEU` workflow. JTL orders are read-only except for size/assets/location. Order submission requires print assets. TimeSlot state machine enforces valid transitions. Missing parts can escalate order workflow. Zod schemas for validation.
**Capacity-Based Scheduling:** Work centers support concurrent capacity. Time slots occupy capacity units within a 5-minute time grid (07:00-18:00). Capacity validation occurs at the API level.

### Data Storage Solutions
**Database:**
- **Development:** SQLite (file-based: `prisma/dev.db`)
- **Production:** PostgreSQL via Neon serverless driver.
**ORM:** Prisma Client for type-safe access.
**Migration Tool:** Drizzle Kit.
**Schema Highlights:** `User` (roles), `Order` (workflow states, sources, departments), `SizeTable` (JSON data), `PrintAsset`, `WorkCenter` (department, capacity), `TimeSlot` (execution tracking), `StorageSlot`, `OrderStorage`.
**Enum Types:** `Role`, `OrderSource`, `Department`, `WorkflowState`, `QCState`, `TimeSlotStatus`.

### Authentication & Authorization
**Authentication:** Session-based using `express-session`, bcrypt hashing (10 rounds) for passwords. Login, profile, and user management pages.
**Role-Based Access Control (RBAC):**
- **Roles:** ADMIN, PROD_PLAN, PROD_RUN, SALES_OPS, ACCOUNTING, LAGER.
- Middleware (`requireAuth`, `requireRole`) enforces access based on authentication and user roles.
**Security:** HttpOnly, SameSite=lax cookies; secure cookies in production; session regeneration on login; password security. All GET endpoints require authentication; state-changing endpoints require specific roles.
**Frontend Security:** UserContext for current user, protected routes redirect to login, navigation filtered by role, server-side logout.

## External Dependencies

### Third-Party Services
- **Planned Integrations (Not Yet Implemented):** JTL Wawi (e-commerce order import), Sevdesk (accounting export), AWS S3 (future file storage).

### NPM Packages
- **Core:** `@prisma/client`, `@neondatabase/serverless`, `express`, `cors`, `cookie-parser`, `zod`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `wouter`.
- **UI:** `@radix-ui/*`, `tailwindcss`, `class-variance-authority`, `cmdk`.
- **Development:** `tsx`, `vite`, `concurrently`, `drizzle-kit`, `esbuild`.

### Database Provider
- **Development:** SQLite.
- **Production:** Neon PostgreSQL.

### Build & Deployment
- **Development:** Concurrent Vite frontend (5173) and Express backend (3000), HMR.
- **Production:** Vite builds frontend to `dist/public`, esbuild bundles backend to `dist/index.js`. Single Node.js process serves both.
- Optimized for Replit deployment.