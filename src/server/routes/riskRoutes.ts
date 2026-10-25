import express from 'express';
import { riskService } from '../services/riskService.ts';

export const riskRoutes = express.Router();
  // F4: Intelligent Risk Service & Queue
  riskRoutes.get('/admin/risk/queue', (_req, res) => {
    const assessments = riskService.getAssessments();
    const links = riskService.getIdentityLinks();
    res.json({ assessments, links });
  });

  riskRoutes.post('/admin/risk/:id/resolve', (req, res) => {
    const { reviewerId, reviewerName, action, resolutionNotes } = req.body;
    try {
      const resolved = riskService.resolveAssessment(req.params.id, reviewerId, reviewerName, action, resolutionNotes);
      res.json(resolved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  riskRoutes.post('/admin/risk/links/:id/decide', (req, res) => {
    const { reviewerId, reviewerName, status } = req.body;
    try {
      const updated = riskService.updateIdentityLink(req.params.id, reviewerId, status, reviewerName);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
