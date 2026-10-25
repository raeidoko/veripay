import express from 'express';
import { asyncRoute } from './routeUtils.ts';
import { orderEscrowService } from '../services/orderEscrowService.ts';
import { evidenceService } from '../services/evidenceService.ts';
import { dispatchService } from '../services/dispatchService.ts';
import { riskService } from '../services/riskService.ts';
import { trustService } from '../services/trustService.ts';
import { aiLayer } from '../services/aiLayer.ts';

export const orderRoutes = express.Router();
  // F1 & F2: Order & Escrow Service
  orderRoutes.get('/orders', (req, res) => {
    const user = res.locals.user;
    const orders = orderEscrowService.getOrdersForUser(user.id, user.role);
    res.json(orders);
  });

  orderRoutes.get('/orders/:id', (req, res) => {
    const order = orderEscrowService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const snapshot = evidenceService.getSnapshotByOrderId(order.id);
    const dispatchContact = dispatchService.getContactByOrderId(order.id);
    const verifications = dispatchService.getVerificationsByOrderId(order.id);
    res.json({ order, snapshot, dispatchContact, verifications });
  });

  orderRoutes.post('/orders', (req, res) => {
    const { buyerId, buyerName, buyerPhone, deliveryAddress, items } = req.body;
    const result = orderEscrowService.createOrder({
      buyerId,
      buyerName,
      buyerPhone: buyerPhone || '+234 803 000 0000',
      deliveryAddress,
      items,
    });
    if (!result.success) return res.status(400).json({ error: result.error });

    // Internal Risk Screening (F4)
    if (result.order) {
      riskService.assessOrder(result.order.id);
    }

    res.status(201).json(result.order);
  });

  // F2: AI Purchase Confirmation Prompt
  orderRoutes.post('/orders/:id/confirmation-prompt', asyncRoute(async (req, res) => {
    const order = orderEscrowService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.state !== 'AWAITING_CONFIRMATION') return res.status(409).json({error:'This order is not awaiting confirmation'});
    const sellerProfile = trustService.getProfile(order.sellerId);
    const prompt = await aiLayer.generateConfirmationPrompt(order, sellerProfile.level);
    order.confirmationText = `${prompt.headline}\n${prompt.summaryText}\n${prompt.keyCheckpoints.join('\n')}\n${prompt.escrowNote}`;
    res.json(prompt);
  }));

  // F2: Buyer Confirmation & Automatic Snapshot creation
  orderRoutes.post('/orders/:id/confirm', (req, res) => {
    const { buyerResponse, confirmationText } = req.body;
    const result = orderEscrowService.confirmOrderPurchase(
      req.params.id,
      buyerResponse,
      confirmationText || 'Buyer confirmed purchase intent'
    );
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.snapshot);
  });

  // Escrow Payment Deposit
  orderRoutes.post('/orders/:id/pay', (req, res) => {
    const result = orderEscrowService.secureEscrowPayment(req.params.id);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.order);
  });

  // F6: Dispatch Contact Registration (Rider or Logistics Company)
  orderRoutes.post('/orders/:id/dispatch-contact', (req, res) => {
    const { sellerId, sellerName, type, name, phone, email, trackingNumber, vehicleNotes } = req.body;
    const result = dispatchService.saveDispatchContact(req.params.id, sellerId, sellerName, {
      type,
      name,
      phone,
      email,
      trackingNumber,
      vehicleNotes,
    });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.contact);
  });

  // F6: Dispatch Order (Enforces Dispatch Contact Gate)
  orderRoutes.post('/orders/:id/dispatch', (req, res) => {
    const { sellerId } = req.body;
    const result = orderEscrowService.dispatchOrder(req.params.id, sellerId);
    if (!result.success) {
      return res.status(result.code || 400).json({ error: result.error });
    }
    res.json(result.order);
  });

  // Buyer Confirms Delivery Receipt
  orderRoutes.post('/orders/:id/delivery-confirm', (req, res) => {
    const { buyerId } = req.body;
    const result = orderEscrowService.confirmDelivery(req.params.id, buyerId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.order);
  });
