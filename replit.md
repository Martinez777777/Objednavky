# Objednávky - Order Management System

## Overview

This is an order management application ("Objednávky" means "Orders" in Slovak) built as a React frontend application. The system provides a menu-driven interface for managing orders, branches (prevadzky), and product imports. It integrates directly with Firebase Firestore for all data storage via REST API calls from the browser.

The application is designed for a restaurant or retail business to manage orders across multiple branches, with features for creating new orders, viewing order statuses (delivered/pending), and importing product data.

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

### Data Storage
- **Firebase Firestore** (REST API, direct from browser)
  - All data: orders, products, branches, dates, admin codes
  - Project ID: objednavky-368a0
  - No server-side database (no PostgreSQL dependency)
  - Configuration in `shared/config.ts`
  - Firebase helper functions in `client/src/lib/firebase.ts`

### Database Structure (Firestore)
- `Prevádzka` -> `Objednavky` -> `Vybraný dátum` -> `Zadaná objednávka`
- `Global/Produkty` - product list
- `Global/Prevadzky` - branch list
- `Global/Datumy` - available dates
- `Global/adminCode` - admin access code

### Backend (Vercel Serverless)
- `api/index.ts` - Vercel serverless function with attendance system API routes
- Express server in `server/` used only for local development (serves Vite + forwards API)
- The ordering system frontend communicates directly with Firebase (no API routes needed)

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database schema definitions (legacy, not actively used)
- `config.ts`: Firebase configuration, menu items, and admin config

### Build & Deployment

#### Local Development
- `npm run dev` runs tsx with Express + Vite middleware on port 5000

#### Vercel Deployment
- `vercel.json` configures the deployment:
  - Build command: `npm run vercel-build` (runs `vite build`)
  - Output directory: `dist/public`
  - API rewrites: `/api/*` -> `api/index.ts` (Vercel serverless function)
  - SPA fallback: all other routes -> `index.html`
- The frontend is built as static files by Vite
- API routes are handled by `api/index.ts` as a Vercel serverless function

## Key Features
- Order creation with product selection, quantities, and notes
- Delivery status tracking ("Vydaná" / "Nevydaná")
- Order filtering by delivery status with search
- Product summary reports ("Objednávky na ODBYT") split by report type
- Admin code verification from Firestore
- Branch and date selection
- Product import functionality

## External Dependencies

### Firebase Firestore
- **Purpose**: All application data storage
- **Project ID**: objednavky-368a0
- **Integration**: REST API calls directly from frontend
- **Base URL**: `https://firestore.googleapis.com/v1/projects/objednavky-368a0/databases/(default)/documents`

### Key NPM Dependencies
- `@tanstack/react-query`: Server state management
- `framer-motion`: Animation library
- `lucide-react`: Icon library
- `wouter`: Client-side routing
- `@vercel/node`: Vercel serverless function types
- Full shadcn/ui component suite (Radix UI based)
