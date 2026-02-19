# Objednávky - Order Management System

## Overview

This is an order management application ("Objednávky" means "Orders" in Slovak) built as a full-stack web application. The system provides a menu-driven interface for managing orders, branches (prevadzky), and product imports. It integrates with Firebase Firestore for data storage and uses a PostgreSQL database for local click tracking analytics.

The application appears to be designed for a restaurant or retail business to manage orders across multiple branches, with features for creating new orders, viewing order statuses (delivered/pending), and importing product data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Animations**: Framer Motion for smooth transitions and hover effects
- **Build Tool**: Vite with hot module replacement

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Custom hooks in `client/src/hooks/`
- Utility functions in `client/src/lib/`

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts`

The backend serves both the API and static files in production. In development, Vite middleware handles the frontend.

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
  - Schema defined in `shared/schema.ts`
  - Migrations stored in `migrations/` directory
  - Database push via `npm run db:push`
- **External Storage**: Firebase Firestore (REST API)
  - Used for products, branches, and admin configuration
  - Direct REST API calls without Firebase SDK

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database schema definitions with Zod validation
- `routes.ts`: API route definitions with type-safe input/output schemas
- `config.ts`: Firebase configuration and menu item definitions

### Build System
- Development: `npm run dev` runs tsx with Vite middleware
- Production: `npm run build` uses esbuild for server and Vite for client
- Output: Server bundle in `dist/index.cjs`, client files in `dist/public/`

## External Dependencies

### Firebase Firestore
- **Purpose**: Stores products, branches (prevadzky), and admin codes
- **Project ID**: objednavky-368a0
- **Integration**: REST API calls (no Firebase SDK)
- **Base URL**: `https://firestore.googleapis.com/v1/projects/objednavky-368a0/databases/(default)/documents`

### PostgreSQL Database
- **Purpose**: Local analytics and click tracking
- **Connection**: Via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with node-postgres driver

### Key NPM Dependencies
- `@tanstack/react-query`: Server state management
- `drizzle-orm` / `drizzle-zod`: Database ORM with schema validation
- `framer-motion`: Animation library
- `lucide-react`: Icon library
- `wouter`: Client-side routing
- Full shadcn/ui component suite (Radix UI based)