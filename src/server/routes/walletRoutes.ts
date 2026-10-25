import express from 'express';
import { walletService } from '../services/walletService.ts';
import { evidenceService as snapshots } from '../services/evidenceService.ts';
import { orderEscrowService } from '../services/orderEscrowService.ts';
import { auditLogService } from '../services/auditLogService.ts';
export const walletRoutes = express.Router();
walletRoutes.get('/wallet', (_req,res) => res.json(walletService.get(res.locals.user.id)));
walletRoutes.get('/wallet/ledger', (_req,res) => res.json(walletService.ledger(res.locals.user.id, res.locals.user.role === 'admin')));
walletRoutes.post('/wallet/topup', (req,res) => {
  try {
    const actor = res.locals.user;
    const wallet = walletService.topup(actor.id, req.body.amount);
    auditLogService.log({actorId:actor.id,actorName:actor.name,actorRole:actor.role,action:'SANDBOX_WALLET_TOPUP',entityType:'USER',entityId:actor.id,changesSummary:`Sandbox wallet credited with NGN ${req.body.amount}. No real money was received.`});
    res.json(wallet);
  }
  catch(error) { res.status(400).json({error:(error as Error).message}); }
});
walletRoutes.get('/orders/:id/snapshot', (req,res) => {
  const snapshot = snapshots.getSnapshotByOrderId(req.params.id);
  if (!snapshot) return res.status(404).json({error:'Purchase snapshot not found'});
  res.json({...snapshot,intact:snapshots.verifySnapshot(req.params.id)});
});
walletRoutes.get('/orders/:id/receipt', (req,res) => {
  const order = orderEscrowService.getOrderById(req.params.id)!;
  if (!['COMPLETED','REFUNDED'].includes(order.state)) return res.status(409).json({error:'Receipt is available after settlement'});
  res.json({order,snapshot:snapshots.getSnapshotByOrderId(order.id),movements:walletService.ledger(res.locals.user.id).filter(item => item.orderId === order.id),mode:'sandbox'});
});
