import { Order, OrderItem } from '../../shared/types.ts';
import { orders, products, users } from '../db/store.ts';
import { auditLogService } from './auditLogService.ts';
import { evidenceService } from './evidenceService.ts';
import { dispatchService } from './dispatchService.ts';
import { trustService } from './trustService.ts';
import { randomUUID } from 'node:crypto';
import { walletService, kobo } from './walletService.ts';
import { text } from '../utils/validation.ts';

export const orderEscrowService = {
  getAllOrders(): Order[] {
    return [...orders].reverse();
  },

  getOrderById(id: string): Order | undefined {
    return orders.find((o) => o.id === id);
  },

  getOrdersForUser(userId: string, role: string): Order[] {
    if (role === 'buyer') {
      return orders.filter((o) => o.buyerId === userId);
    }
    if (role === 'seller') {
      return orders.filter((o) => o.sellerId === userId);
    }
    return orders; // Reviewers and admins view all orders
  },

  createOrder(params: {
    buyerId: string;
    buyerName: string;
    buyerPhone: string;
    deliveryAddress: string;
    items: {
      productId: string;
      variantName?: string;
      quantity: number;
    }[];
  }): { success: boolean; order?: Order; error?: string } {
    if (!Array.isArray(params.items) || params.items.length === 0 || params.items.length > 100) {
      return { success: false, error: 'Order must contain at least one item' };
    }
    const buyer = users.find(user => user.id === params.buyerId && user.role === 'buyer');
    if (!buyer || buyer.isRestricted || buyer.accountStatus !== 'APPROVED') return { success: false, error: 'Buyer account cannot trade' };
    try { params.deliveryAddress = text(params.deliveryAddress, 'Delivery address', 5, 500); }
    catch (error) { return { success: false, error: (error as Error).message }; }
    if (params.items.some(item => !item || typeof item.productId !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000)) return {success:false,error:'Each item needs a product and a positive whole quantity (maximum 1,000)'};

    const firstProduct = products.find((p) => p.id === params.items[0].productId);
    if (!firstProduct) {
      return { success: false, error: 'Product not found in catalog' };
    }

    const sellerId = firstProduct.sellerId;
    const sellerName = firstProduct.sellerName;
    const deliveryTerms = firstProduct.deliveryTerms;

    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const item of params.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return { success:false, error:'Product not found in catalog' };
      if (prod.sellerId !== sellerId) return { success:false,error:'Create a separate order for each seller' };
      if (users.find(user => user.id === prod.sellerId)?.isRestricted) return {success:false,error:'Seller account cannot trade'};
      if (['HIDDEN','PENDING'].includes(prod.moderationStatus || '') || users.find(user => user.id === prod.sellerId)?.accountStatus !== 'APPROVED') return {success:false,error:'This product is not available for purchase'};
      const variant = prod.variants.find((v) => v.name === item.variantName);
      if (item.variantName && !variant) return { success:false,error:'Selected product variant does not exist' };
      const requested = params.items.filter(line => line.productId === prod.id).reduce((sum, line) => sum + line.quantity, 0);
      const variantRequested = params.items.filter(line => line.productId === prod.id && line.variantName === item.variantName).reduce((sum, line) => sum + line.quantity, 0);
      if (requested > prod.stock || (variant && variantRequested > variant.stock)) return { success:false,error:'Not enough stock for this order' };
      const unitPrice = prod.price + (variant ? variant.priceDelta : 0);
      try { kobo(unitPrice); } catch { return {success:false,error:'Product price is invalid'}; }
      const itemSubtotal = kobo(unitPrice) * item.quantity / 100;
      subtotal += itemSubtotal;

      orderItems.push({
        productId: prod.id,
        productName: prod.name,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice,
        subtotal: itemSubtotal,
        imageUrl: prod.imageUrl,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const escrowFee = Math.round(subtotal * 100 * 0.015) / 100;
    const totalAmount = Math.round((subtotal + escrowFee) * 100) / 100;
    try { kobo(totalAmount); } catch { return {success:false,error:'Order exceeds the supported amount'}; }
    const orderId = `ord_${randomUUID()}`;
    const orderNumber = `VP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      buyerId: params.buyerId,
      buyerName: params.buyerName,
      buyerPhone: params.buyerPhone,
      sellerId,
      sellerName,
      items: orderItems,
      subtotal,
      escrowFee,
      totalAmount,
      currency: 'NGN',
      state: 'AWAITING_CONFIRMATION', // Moves directly to F2 AI Purchase Confirmation
      deliveryAddress: params.deliveryAddress,
      deliveryTerms,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);

    auditLogService.log({
      actorId: params.buyerId,
      actorName: params.buyerName,
      actorRole: 'buyer',
      action: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: newOrder.id,
      changesSummary: `Order ${newOrder.orderNumber} created for ₦${totalAmount.toLocaleString()} awaiting AI purchase confirmation.`,
    });

    return { success: true, order: newOrder };
  },

  /**
   * F2: Buyer confirms "Is this what you really want to purchase?"
   * Creates immutable Purchase Snapshot (SHA-256) and advances order
   */
  confirmOrderPurchase(
    orderId: string,
    buyerResponse: string,
    confirmationPromptText: string
  ): { success: boolean; snapshot?: any; error?: string } {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.state !== 'AWAITING_CONFIRMATION') return {success:false,error:'This order is not awaiting purchase confirmation'};
    if (buyerResponse !== 'YES_CONFIRMED') return {success:false,error:'Explicit purchase confirmation is required'};
    // The client cannot replace the purchase agreement with arbitrary text.
    const agreement = order.confirmationText || `${order.buyerName} confirms ${order.items.map(item => `${item.quantity}x ${item.productName} (${item.variantName || 'Standard'})`).join(', ')} from ${order.sellerName} for NGN ${order.totalAmount.toFixed(2)}, including escrow fee NGN ${order.escrowFee.toFixed(2)}, delivered to ${order.deliveryAddress}. Terms: ${order.deliveryTerms}`;
    const snapshot = evidenceService.createPurchaseSnapshot(order, agreement, buyerResponse);
    order.purchaseSnapshotId = snapshot.id;
    order.state = order.hasRiskFlag && order.riskLevel === 'HIGH' ? 'RISK_HOLD' : 'PENDING_PAYMENT';
    order.updatedAt = new Date().toISOString();

    return { success: true, snapshot };
  },

  /**
   * Buyer deposits escrow funds -> PAYMENT_SECURED
   */
  secureEscrowPayment(orderId: string): { success: boolean; order?: Order; error?: string } {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.state !== 'PENDING_PAYMENT') return {success:false,error:'Only a confirmed order awaiting payment can be funded'};
    if (!evidenceService.verifySnapshot(order.id)) return {success:false,error:'Purchase snapshot integrity check failed'};
    for (const item of order.items) {
      const product = products.find(product => product.id === item.productId);
      const seller = users.find(user => user.id === order.sellerId);
      if (!product || ['PENDING','HIDDEN'].includes(product.moderationStatus || '') || seller?.accountStatus !== 'APPROVED' || seller.isRestricted) return {success:false,error:'This product is no longer available'};
      const quantity = order.items.filter(line => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
      const variant = item.variantName ? product.variants.find(variant => variant.name === item.variantName) : undefined;
      const variantQuantity = order.items.filter(line => line.productId === product.id && line.variantName === item.variantName).reduce((sum, line) => sum + line.quantity, 0);
      if (quantity > product.stock || (item.variantName && (!variant || variantQuantity > variant.stock))) return {success:false,error:'Not enough stock to fund this order'};
    }
    try { walletService.hold(order); } catch (error) { return {success:false,error:(error as Error).message}; }
    for (const item of order.items) {
      const product = products.find(product => product.id === item.productId)!;
      product.stock -= item.quantity;
      const variant = product.variants.find(variant => variant.name === item.variantName);
      if (variant) variant.stock -= item.quantity;
    }
    order.state = 'PAYMENT_SECURED';
    order.updatedAt = new Date().toISOString();

    auditLogService.log({
      actorId: order.buyerId,
      actorName: order.buyerName,
      actorRole: 'buyer',
      action: 'ESCROW_PAYMENT_SECURED',
      entityType: 'ORDER',
      entityId: order.id,
      changesSummary: `₦${order.totalAmount.toLocaleString()} deposited into VeriPay Escrow custody for Order ${order.orderNumber}.`,
    });

    return { success: true, order };
  },

  /**
   * F6: Dispatch verification gate
   * Seller cannot dispatch until valid contact is saved!
   */
  dispatchOrder(orderId: string, sellerId: string): { success: boolean; order?: Order; error?: string; code?: number } {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found', code: 404 };

    if (order.sellerId !== sellerId) {
      return { success: false, error: 'Unauthorized seller action', code: 403 };
    }
    if (order.state !== 'PAYMENT_SECURED') return {success:false,error:'Only a funded order can be dispatched',code:409};

    const contact = dispatchService.getContactByOrderId(orderId);
    if (!contact) {
      return {
        success: false,
        error: 'F6 Compliance Requirement: You must register a verified dispatch rider phone number or logistics company contact before dispatching.',
        code: 422,
      };
    }

    order.state = 'DISPATCHED';
    order.dispatchedAt = new Date().toISOString();
    const days = Math.max(1, ...order.items.map(item => products.find(product => product.id === item.productId)?.estimatedDays || 3));
    order.expectedDeliveryAt = new Date(Date.now() + days * 86400000).toISOString();
    order.updatedAt = new Date().toISOString();

    auditLogService.log({
      actorId: sellerId,
      actorName: order.sellerName,
      actorRole: 'seller',
      action: 'ORDER_DISPATCHED',
      entityType: 'ORDER',
      entityId: order.id,
      changesSummary: `Order ${order.orderNumber} marked DISPATCHED with registered rider ${contact.name} (${contact.phone}).`,
    });

    return { success: true, order };
  },

  /**
   * Buyer confirms receipt of order
   */
  confirmDelivery(orderId: string, buyerId: string): { success: boolean; order?: Order; error?: string } {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    if (order.buyerId !== buyerId) {
      return { success: false, error: 'Only the designated buyer can confirm delivery' };
    }
    if (!['DISPATCHED', 'IN_TRANSIT', 'DELIVERED'].includes(order.state)) return {success:false,error:'Only a dispatched order can be confirmed delivered'};
    try { walletService.settle(order, 'SELLER_PAID'); } catch (error) { return {success:false,error:(error as Error).message}; }

    order.state = 'COMPLETED';
    order.updatedAt = new Date().toISOString();

    // Trigger F5 Trust Event for seller (completed without dispute)
    trustService.recordTrustEvent({
      userId: order.sellerId,
      type: 'TRANSACTION_COMPLETED',
      orderId: order.id,
      weight: 10,
      description: `Escrow order ${order.orderNumber} completed with verified buyer confirmation.`,
    });

    auditLogService.log({
      actorId: buyerId,
      actorName: order.buyerName,
      actorRole: 'buyer',
      action: 'DELIVERY_CONFIRMED_FUNDS_RELEASED',
      entityType: 'ORDER',
      entityId: order.id,
      changesSummary: `Buyer confirmed satisfactory delivery. Escrow funds ₦${order.subtotal.toLocaleString()} released to seller ${order.sellerName}.`,
    });

    return { success: true, order };
  },

  /**
   * Human reviewer release/refund (consequential outcome)
   */
  releaseOrRefundEscrow(
    orderId: string,
    action: 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER',
    reviewerId: string,
    reviewerName: string,
    rationale: string
  ): { success: boolean; order?: Order; error?: string } {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.state !== 'DISPUTED') return {success:false,error:'Only disputed escrow can be settled by a reviewer'};
    try { walletService.settle(order, action === 'REFUND_TO_BUYER' ? 'BUYER_REFUNDED' : 'SELLER_PAID'); }
    catch (error) { return {success:false,error:(error as Error).message}; }
    if (action === 'REFUND_TO_BUYER') {
      order.state = 'REFUNDED';
      auditLogService.log({
        actorId: reviewerId,
        actorName: reviewerName,
        actorRole: 'admin',
        action: 'CONSEQUENTIAL_ESCROW_REFUND',
        entityType: 'ORDER',
        entityId: order.id,
        changesSummary: `Reviewer approved full escrow refund of ₦${order.totalAmount.toLocaleString()} to buyer ${order.buyerName}. Rationale: ${rationale}`,
      });
    } else {
      order.state = 'COMPLETED';
      auditLogService.log({
        actorId: reviewerId,
        actorName: reviewerName,
        actorRole: 'admin',
        action: 'CONSEQUENTIAL_ESCROW_PAYOUT',
        entityType: 'ORDER',
        entityId: order.id,
        changesSummary: `Reviewer approved escrow payout of ₦${order.subtotal.toLocaleString()} to seller ${order.sellerName}. Rationale: ${rationale}`,
      });
    }

    order.updatedAt = new Date().toISOString();
    return { success: true, order };
  },
};
