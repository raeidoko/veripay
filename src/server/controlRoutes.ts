import express from 'express';
import type { ErrorRequestHandler } from 'express';
import path from 'node:path';
import { platformService, governanceDirectory } from './services/platformService.ts';

export const controlRoutes = express.Router();
controlRoutes.get('/platform', (_req,res) => {
  const {announcement,purchasesPaused} = platformService.settings();
  res.json({announcement,purchasesPaused});
});
controlRoutes.get('/admin/control', (_req,res) => res.json(platformService.control()));
controlRoutes.get('/admin/users/:id/profile', (req,res) => {
  const profile = platformService.userProfile(req.params.id);
  if (!profile) return res.status(404).json({error:'Account not found'});
  res.json(profile);
});
function action(handler: (req: express.Request, res: express.Response) => unknown): express.RequestHandler {
  return (req,res) => { try { handler(req,res); } catch (error: unknown) { res.status(400).json({error:error instanceof Error ? error.message : 'Action failed'}); } };
}
controlRoutes.post('/admin/users/:id/status', action((req,res) => res.json(platformService.setUserStatus(res.locals.user,req.params.id,req.body.status,req.body.notes))));
controlRoutes.post('/admin/documents/:id/review', action((req,res) => res.json(platformService.reviewDocument(res.locals.user,req.params.id,req.body.status,req.body.notes))));
controlRoutes.post('/admin/products/:id/moderate', action((req,res) => res.json(platformService.moderateProduct(res.locals.user,req.params.id,req.body.status,req.body.notes))));
controlRoutes.post('/admin/reviews/:id/moderate', action((req,res) => { platformService.moderateReview(res.locals.user,req.params.id,req.body.hidden,req.body.notes); res.json({success:true}); }));
controlRoutes.post('/admin/settings', action((req,res) => res.json(platformService.updateSettings(res.locals.user,req.body))));
controlRoutes.get('/verification', (_req,res) => res.json(platformService.ownVerification(res.locals.user)));
const types = ['application/pdf','image/jpeg','image/png'];
controlRoutes.post('/verification/documents', express.raw({type:types,limit:10*1024*1024}), action((req,res) => {
  let filename = req.get('X-File-Name') || 'document';
  try { filename = decodeURIComponent(filename); } catch { /* Keep safe basename fallback */ }
  res.status(201).json(platformService.uploadDocument(res.locals.user,req.body,req.get('Content-Type') || '',filename,req.get('X-Document-Type') || 'OTHER'));
}));
const uploadError: ErrorRequestHandler = (error,_req,res,_next) => res.status(error.status === 413 ? 413 : 400).json({error:error.status === 413 ? 'Documents must be 10 MB or smaller' : 'Could not upload document'});
controlRoutes.use('/verification/documents', uploadError);
controlRoutes.get('/verification/documents/:id/file', (req,res) => {
  const doc = platformService.document(req.params.id);
  if (!doc) return res.status(404).json({error:'Document not found'});
  if (res.locals.user.role !== 'admin' && res.locals.user.id !== doc.userId) return res.status(403).json({error:'You cannot access this document'});
  res.set('Cache-Control','no-store');
  res.set('X-Content-Type-Options','nosniff');
  if (req.query.preview === '1') {
    res.set('Content-Type',doc.mimeType);
    res.set('Content-Disposition','inline');
    res.set('Content-Security-Policy',"sandbox; default-src 'none'; frame-ancestors 'self'");
    return res.sendFile(path.resolve(governanceDirectory,'documents',doc.filename));
  }
  res.download(path.join(governanceDirectory,'documents',doc.filename),doc.originalName);
});
