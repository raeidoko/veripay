import express from 'express';
import { asyncRoute, visibleDispute } from './routeUtils.ts';
import { orderEscrowService } from '../services/orderEscrowService.ts';
import { disputeService } from '../services/disputeService.ts';
import { evidenceService } from '../services/evidenceService.ts';
import { dispatchService } from '../services/dispatchService.ts';

export const disputeRoutes = express.Router();
  // F3: Dispute Service
  disputeRoutes.get('/disputes', (_req, res) => {
    const user = res.locals.user;
    const visibleOrders = new Set(orderEscrowService.getOrdersForUser(user.id, user.role).map(o => o.id));
    res.json(disputeService.getAllDisputes().filter(d => visibleOrders.has(d.orderId)).map(d => visibleDispute(d,user.role === 'admin')));
  });

  disputeRoutes.get('/disputes/:id', (req, res) => {
    const dispute = disputeService.getDisputeById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    res.json(visibleDispute(dispute,res.locals.user.role === 'admin'));
  });

  disputeRoutes.post('/disputes', asyncRoute(async (req, res) => {
    const { orderId, openedBy, openerName, reason, details, claimedAmount } = req.body;
    try {
      const dispute = await disputeService.openDispute({
        orderId,
        openedBy,
        openerName,
        reason,
        details,
        claimedAmount: Number(claimedAmount),
      });
      res.status(201).json(visibleDispute(dispute,res.locals.user.role === 'admin'));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }));

  disputeRoutes.post('/disputes/:id/evidence', (req, res) => {
    const { party, type, title, description, url } = req.body;
    try {
      const item = evidenceService.addEvidenceToDispute({
        disputeId: req.params.id,
        party,
        type,
        title,
        description,
        url,
      });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  disputeRoutes.post('/disputes/:id/respond', (req, res) => {
    const { requestId, responseText } = req.body;
    try {
      const reqUpdated = disputeService.respondToInfoRequest(req.params.id, requestId, responseText);
      res.json(reqUpdated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // F6 / F3: Delivery Verification Task & Outcome Recording
  disputeRoutes.post('/disputes/:id/analyze', asyncRoute(async (req,res) => {
    try { res.json(await disputeService.triggerAIAnalysis(req.params.id)); }
    catch(error) { res.status(400).json({error:(error as Error).message}); }
  }));
  disputeRoutes.post('/disputes/:id/info-requests', (req,res) => {
    try { res.status(201).json(disputeService.addInfoRequest(req.params.id, req.body.requestedFrom, req.body.question)); }
    catch(error) { res.status(400).json({error:(error as Error).message}); }
  });
  disputeRoutes.post('/disputes/:id/delivery-verification', (req, res) => {
    const { orderId, contactId, requestedBy, agentName, method, outcome, notes } = req.body;
    try {
      const dver = dispatchService.recordDeliveryVerification(orderId, {
        contactId,
        requestedBy,
        agentName,
        method,
        outcome,
        notes,
        disputeId: req.params.id,
      });
      res.status(201).json(dver);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // F3: Human Reviewer Consequential Decision
  disputeRoutes.post('/disputes/:id/decision', (req, res) => {
    const { reviewerId, reviewerName, decision, rationale } = req.body;
    try {
      const decided = disputeService.decideDispute({
        disputeId: req.params.id,
        reviewerId,
        reviewerName,
        decision,
        rationale,
      });
      res.json(decided);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
