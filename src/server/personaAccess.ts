import type { RequestHandler } from 'express';
import type { Order } from '../shared/types.ts';
import { trustEvents } from './db/store.ts';
import { authService } from './services/authService.ts';
import { orderEscrowService } from './services/orderEscrowService.ts';
import { disputeService } from './services/disputeService.ts';
import { catalogService } from './services/catalogService.ts';
import { dispatchService } from './services/dispatchService.ts';
import { platformService } from './services/platformService.ts';

// Permissions are derived from the server-side session, never a client role or ID.
export const personaAccess: RequestHandler = (req, res, next) => {
  const route = req.path;
  const read = req.method === 'GET';
  if (route === '/platform' && read) return next();
  if (read && (/^\/products(?:\/[^/]+(?:\/reviews)?)?$/.test(route) || /^\/users\/[^/]+\/passport$/.test(route))) return next();

  const user = authService.currentUser(req);
  if (!user) { res.status(401).json({ error: 'Sign in to continue' }); return; }
  res.set('Cache-Control', 'no-store');
  res.locals.user = user;
  const staff = user.role === 'admin';
  const party = user.role === 'buyer' || user.role === 'seller';
  const ownsOrder = (order: Order) => user.role === 'buyer' ? order.buyerId === user.id : user.role === 'seller' && order.sellerId === user.id;
  const deny = () => { res.status(403).json({ error: 'This action is not available for your persona' }); };
  const missing = () => { res.status(404).json({ error: 'Record not found' }); };

  if (route === '/users') return staff && read ? next() : deny();
  if (route === '/verification' && read) return next();
  if (route === '/verification/documents' && req.method === 'POST' && party) return next();
  if (/^\/verification\/documents\/[^/]+\/file$/.test(route) && read) return next();
  if (!read && party && user.accountStatus !== 'APPROVED') {
    return res.status(403).json({error:'Your account is awaiting admin approval. Submit documents in Verification.'});
  }
  // Restrictions stop new trading; users retain review, evidence and appeal access.
  if (!read && party && user.isRestricted && (route === '/orders' || route.startsWith('/orders/') || route.startsWith('/seller/') || route === '/wallet/topup')) return res.status(403).json({error:'This account is restricted. Contact the administrator.'});
  if (route === '/wallet' && read) return next();
  if (route === '/wallet/ledger' && read) return next();
  if (route === '/wallet/topup') return req.method === 'POST' && user.role === 'buyer' ? next() : deny();
  if (route === '/orders' && req.method === 'POST' && platformService.settings().purchasesPaused) {
    return res.status(403).json({error:'New purchases are temporarily paused by the admin'});
  }

  if (route === '/seller/product-images') return user.role === 'seller' && req.method === 'POST' ? next() : deny();

  if (/^\/products\/[^/]+\/reviews$/.test(route)) {
    return user.role === 'buyer' && req.method === 'POST' ? next() : deny();
  }

  if (route.startsWith('/admin/')) {
    if (user.role !== 'admin') return deny();
    req.body = { ...req.body, reviewerId: user.id, reviewerName: user.name };
    return next();
  }
  if (route === '/audit-logs') return staff && read ? next() : deny();
  if (route === '/assistant/search') return user.role === 'buyer' ? next() : deny();
  if (route.startsWith('/seller/products')) {
    if (user.role !== 'seller') return deny();
    const id = route.match(/^\/seller\/products\/([^/]+)$/)?.[1];
    if (id) {
      const product = catalogService.getProductById(id);
      if (!product) return missing();
      if (product.sellerId !== user.id) return deny();
    }
    req.body = { ...req.body, sellerId: user.id, sellerName: user.name };
    if (req.body.updates) {
      const { sellerId, sellerName, id, moderationStatus, moderationNotes, rating, reviewsCount, ...updates } = req.body.updates;
      req.body.updates = updates;
    }
    return next();
  }
  if (route === '/orders') {
    if (read) return next();
    if (user.role !== 'buyer') return deny();
    req.body = { ...req.body, buyerId: user.id, buyerName: user.name, buyerPhone: user.phone };
    return next();
  }
  const orderRoute = route.match(/^\/orders\/([^/]+)(?:\/([^/]+))?$/);
  if (orderRoute) {
    const order = orderEscrowService.getOrderById(orderRoute[1]);
    if (!order) return missing();
    if (read) return staff || ownsOrder(order) ? next() : deny();
    if (!ownsOrder(order)) return deny();
    const action = orderRoute[2];
    if (['confirmation-prompt', 'confirm', 'pay', 'delivery-confirm'].includes(action) && user.role === 'buyer') {
      req.body = { ...req.body, buyerId: user.id };
      return next();
    }
    if (['dispatch', 'dispatch-contact'].includes(action) && user.role === 'seller') {
      req.body = { ...req.body, sellerId: user.id, sellerName: user.name };
      return next();
    }
    return deny();
  }
  if (route === '/disputes') {
    if (read) return next();
    if (!party) return deny();
    const order = orderEscrowService.getOrderById(req.body.orderId);
    if (!order) return missing();
    if (!ownsOrder(order)) return deny();
    req.body = { ...req.body, openedBy: user.role.toUpperCase(), openerName: user.name };
    return next();
  }
  const disputeRoute = route.match(/^\/disputes\/([^/]+)(?:\/([^/]+))?$/);
  if (disputeRoute) {
    const dispute = disputeService.getDisputeById(disputeRoute[1]);
    if (!dispute) return missing();
    const order = orderEscrowService.getOrderById(dispute.orderId);
    if (!order) return missing();
    if (read) return staff || ownsOrder(order) ? next() : deny();
    const action = disputeRoute[2];
    if (['decision','delivery-verification','analyze','info-requests'].includes(action || '')) {
      if (user.role !== 'admin') return deny();
      req.body = { ...req.body, reviewerId: user.id, reviewerName: user.name, requestedBy: user.id, agentName: user.name, orderId: order.id };
      if (action === 'delivery-verification') {
        const contact = dispatchService.getContactByOrderId(order.id);
        if (!contact || contact.id !== req.body.contactId) return deny();
      }
      return next();
    }
    if (action === 'evidence' && (user.role === 'admin' || ownsOrder(order))) {
      req.body = { ...req.body, party: user.role === 'admin' ? 'REVIEWER' : user.role.toUpperCase() };
      return next();
    }
    if (action === 'respond' && ownsOrder(order)) {
      const request = dispute.infoRequests.find(r => r.id === req.body.requestId);
      if (!request) return missing();
      return request.requestedFrom === user.role.toUpperCase() ? next() : deny();
    }
    return deny();
  }
  if (route === '/me/passport/factors') return staff || req.query.userId === user.id ? next() : deny();
  if (route === '/me/passport/challenges') {
    const event = trustEvents.find(e => e.id === req.body.eventId);
    if (!event) return missing();
    if (event.userId !== user.id) return deny();
    req.body = { ...req.body, userId: user.id, userName: user.name };
    return next();
  }
  res.status(404).json({ error: 'API route not found' });
};
