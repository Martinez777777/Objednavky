import type { Express } from "express";
import { type Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // The frontend communicates directly with Firebase Firestore.
  // No server-side API routes are needed in development.
  // The api/index.ts handler is used only on Vercel deployment.
  return httpServer;
}
