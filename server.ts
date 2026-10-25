import 'dotenv/config';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { personaAccess } from './src/server/personaAccess.ts';
import { productImageDirectory, saveProductImage } from './src/server/services/productImageService.ts';
import { MAX_PRODUCT_IMAGE_BYTES, PRODUCT_IMAGE_TYPES } from './src/shared/productImages.ts';
import { authService } from './src/server/services/authService.ts';
import { controlRoutes } from './src/server/controlRoutes.ts';
import { domainRoutes } from './src/server/routes/domainRoutes.ts';
import { databasePath, initializePersistence, persistenceMiddleware, storageHealth } from './src/server/db/persistence.ts';
import { governanceDirectory } from './src/server/services/platformService.ts';
import { sandboxPayments, walletService } from './src/server/services/walletService.ts';
import { asyncRoute } from './src/server/routes/routeUtils.ts';
import { serverPort } from './src/server/config.ts';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = serverPort();
  walletService.initialize();
  initializePersistence();

  app.use(express.json());
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin'); next(); });
  app.get('/api/health', (_req, res) => {
    try { res.set('Cache-Control','no-store').json({ok:true, storage:storageHealth(), payments:sandboxPayments ? 'sandbox' : 'unconfigured'}); }
    catch { res.status(503).json({ok:false,error:'Database is unavailable'}); }
  });
  app.use('/api', persistenceMiddleware);
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('Origin');
      if (req.get('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('Host')}`)) {
        return res.status(403).json({ error: 'Cross-site requests are not allowed' });
      }
    }
    next();
  });
  app.get('/api/auth/demo-accounts', (_req, res) => { res.set('Cache-Control', 'no-store').json(authService.demoAccounts()); });
  app.post('/api/auth/login', (req, res) => { res.set('Cache-Control', 'no-store'); authService.login(req, res); });
  app.post('/api/auth/register', (req, res) => { res.set('Cache-Control','no-store'); authService.register(req,res); });
  app.get('/api/auth/me', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const user = authService.currentUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in to continue' });
    res.json({ user });
  });
  app.post('/api/auth/logout', (req, res) => {
    authService.logout(req, res);
    res.set('Cache-Control', 'no-store').json({ success: true });
  });
  app.use('/api', personaAccess);
  app.use('/api', controlRoutes);
  app.use('/uploads/products', express.static(productImageDirectory, {
    immutable: true, maxAge: '1y', fallthrough: false,
    setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }));

  app.post('/api/seller/product-images', express.raw({ type: PRODUCT_IMAGE_TYPES, limit: MAX_PRODUCT_IMAGE_BYTES }), asyncRoute(async (req, res) => {
    if (!PRODUCT_IMAGE_TYPES.includes(req.get('Content-Type') || '')) {
      return res.status(415).json({ error: 'Choose a JPG, PNG, or WebP image' });
    }
    try {
      const imageUrl = await saveProductImage(req.body, req.get('Content-Type')!);
      res.status(201).json({ imageUrl });
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not upload image' });
    }
  }));
  const imageUploadError: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Images must be 5 MB or smaller' : 'Could not upload image' });
  };
  app.use('/api/seller/product-images', imageUploadError);

  app.use('/api', domainRoutes);
  app.use('/api', (_req, res) => { res.status(404).json({error:'API route not found'}); });
  const apiError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) { res.destroy(); return; }
    const status = error.status === 413 ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) console.error('API request failed:', error);
    res.status(status).json({error:status === 413 ? 'Request is too large' : status === 400 ? 'Request body must be valid JSON' : 'Could not process this request'});
  };
  app.use(apiError);
  // Block private paths even when a legacy JSON file no longer exists and Vite
  // would otherwise serve the SPA fallback. Also cover custom database locations.
  app.use((req,res,next) => {
    let decoded: string;
    try { decoded = decodeURIComponent(req.path).replaceAll('\\', '/'); }
    catch { res.status(400).end(); return; }
    const resolved = path.resolve(decoded.startsWith('/@fs/') ? decoded.slice(5) : path.join(__dirname, decoded.replace(/^\/+/, ''))).toLowerCase();
    const privateRoots = [governanceDirectory, path.join(__dirname,'data'), path.join(__dirname,'backups'), path.join(__dirname,'.git')];
    const privateFiles = ['', '-wal', '-shm', '-journal'].map(suffix => path.resolve(databasePath + suffix).toLowerCase());
    if (privateFiles.includes(resolved) || privateRoots.some(root => resolved === path.resolve(root).toLowerCase() || resolved.startsWith(path.resolve(root).toLowerCase() + path.sep)) || /(?:^|\/)\.env(?:\.|$)|\.(?:sqlite|db)(?:-wal|-shm|-journal)?$/i.test(decoded)) {
      res.status(403).json({error:'Private files cannot be served'}); return;
    }
    next();
  });

  // ---------------- DEV VITE MIDDLEWARE ----------------
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VeriPay Platform Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exitCode = 1;
});
