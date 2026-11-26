import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createAuthMiddleware } from './auth.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createFoodRoutes } from './routes/foodRoutes.js';
import { createRequestRoutes } from './routes/requestRoutes.js';
import { createDistributionRoutes } from './routes/distributionRoutes.js';
import { createNotificationRoutes } from './routes/notificationRoutes.js';
import { createAdminRoutes } from './routes/adminRoutes.js';

export function createApp(db, options = {}) {
  const app = express();
  const authMiddleware = createAuthMiddleware(db);

  // Basic security headers (SRS 4.2.2)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Food Rescue Management System', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', createAuthRoutes(db, authMiddleware));
  app.use('/api/foods', createFoodRoutes(db, authMiddleware));
  app.use('/api/requests', createRequestRoutes(db, authMiddleware));
  app.use('/api/distributions', createDistributionRoutes(db, authMiddleware));
  app.use('/api/notifications', createNotificationRoutes(db, authMiddleware));
  app.use('/api/admin', createAdminRoutes(db, authMiddleware));

  // API 404 handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Serve built React frontend in production / standalone mode
  const distDir = options.distDir || path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Graceful error handler (SRS 4.2.3)
  app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
  });

  return app;
}
