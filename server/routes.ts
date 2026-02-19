import type { Express } from "express";
import { createServer, type Server } from "http";
import handler from "../api/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Forward all /api requests to the Vercel handler
  app.use('/api', async (req, res) => {
    // The handler expects req.url to be relative to the function, 
    // but in Vercel it might be different. 
    // api/index.ts logic: if (!url.startsWith('/api')) url = '/api' + ...
    // So passing req/res directly should work if types match.
    // However, VercelRequest adds some properties. Express Request is close enough.
    
    // We need to cast to any because VercelRequest/Response types might slightly differ
    await handler(req as any, res as any);
  });

  return httpServer;
}
