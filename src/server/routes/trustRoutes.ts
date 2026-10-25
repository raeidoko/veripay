import express from 'express';
import { users } from '../db/store.ts';
import { trustService } from '../services/trustService.ts';

export const trustRoutes = express.Router();
  // F5: Trust Passport 2.0
  trustRoutes.get('/users/:id/passport', (req, res) => {
    if (!users.some(user => user.id === req.params.id)) return res.status(404).json({error:'User not found'});
    const profile = trustService.getProfile(req.params.id);
    res.json(profile);
  });

  trustRoutes.get('/me/passport/factors', (req, res) => {
    const userId = (req.query.userId as string) || res.locals.user.id;
    const profile = trustService.getProfile(userId);
    const events = trustService.getUserEvents(userId);
    res.json({ profile, events });
  });

  trustRoutes.post('/me/passport/challenges', (req, res) => {
    const { eventId, userId, userName, reason } = req.body;
    try {
      const challenge = trustService.challengeEvent(eventId, userId, userName, reason);
      res.status(201).json(challenge);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  trustRoutes.post('/admin/passport/challenges/:id/decide', (req, res) => {
    const { reviewerId, decision, decisionNotes } = req.body;
    try {
      const resolved = trustService.resolveChallenge(req.params.id, reviewerId, decision, decisionNotes);
      res.json(resolved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
