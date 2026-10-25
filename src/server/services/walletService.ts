import { randomUUID } from 'node:crypto';
import { registerState } from '../db/persistence.ts';
import { orders, users } from '../db/store.ts';
import type { Order } from '../../shared/types.ts';

interface Movement { id: string; orderId?: string; from: string; to: string; amountKobo: number; reason: string; at: string }
const finance = registerState('finance', {
  initialized: false,
  balances: {} as Record<string, number>,
  holds: {} as Record<string, { buyerId: string; amountKobo: number }>,
  ledger: [] as Movement[],
});
export const sandboxPayments = process.env.VERIPAY_SANDBOX_PAYMENTS !== 'false';
export function kobo(amount: number) {
  const value = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(value) || value > 100_000_000_000 || Math.abs(value / 100 - amount) > 0.000001) throw new Error('Enter a positive amount with at most two decimal places (maximum ₦1 billion)');
  return value;
}
function entry(from: string, to: string, amountKobo: number, reason: string, orderId?: string) {
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) throw new Error('Invalid ledger amount');
  finance.ledger.push({ id: randomUUID(), from, to, amountKobo, reason, orderId, at: new Date().toISOString() });
}
export const walletService = {
  initialize() {
    if (finance.initialized) return;
    // Explicit opening entries reconcile the existing demo orders with the ledger.
    if (sandboxPayments) {
      for (const user of users.filter(user => user.role === 'buyer')) {
        finance.balances[user.id] = 1_000_000_000;
        entry('sandbox', user.id, 1_000_000_000, 'DEMO_OPENING_BALANCE');
      }
      for (const order of orders.filter(order => ['PAYMENT_SECURED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED'].includes(order.state))) {
        finance.holds[order.id] = { buyerId: order.buyerId, amountKobo: kobo(order.totalAmount) };
        entry('sandbox', `escrow:${order.id}`, kobo(order.totalAmount), 'DEMO_OPENING_ESCROW', order.id);
      }
    }
    finance.initialized = true;
  },
  get(userId: string) {
    const held = Object.values(finance.holds).filter(hold => hold.buyerId === userId).reduce((sum, hold) => sum + hold.amountKobo, 0);
    return { available: (finance.balances[userId] || 0) / 100, held: held / 100, currency: 'NGN', mode: sandboxPayments ? 'sandbox' : 'disabled' };
  },
  ledger(userId: string, staff = false) {
    return finance.ledger.filter(item => staff || item.from === userId || item.to === userId || (item.orderId && orders.some(order => order.id === item.orderId && (order.buyerId === userId || order.sellerId === userId))));
  },
  topup(userId: string, amount: number) {
    if (!sandboxPayments) throw new Error('Sandbox payments are disabled');
    const value = kobo(amount);
    if ((finance.balances[userId] || 0) + value > 100_000_000_000) throw new Error('Sandbox wallet limit exceeded');
    finance.balances[userId] = (finance.balances[userId] || 0) + value;
    entry('sandbox', userId, value, 'SANDBOX_TOPUP');
    return this.get(userId);
  },
  hold(order: Order) {
    if (!sandboxPayments) throw new Error('Payment provider is not configured. Sandbox payments are disabled.');
    if (finance.holds[order.id]) throw new Error('This order is already funded');
    const value = kobo(order.totalAmount);
    if ((finance.balances[order.buyerId] || 0) < value) throw new Error('Insufficient sandbox wallet balance. Top up your wallet first.');
    finance.balances[order.buyerId] -= value;
    finance.holds[order.id] = { buyerId: order.buyerId, amountKobo: value };
    entry(order.buyerId, `escrow:${order.id}`, value, 'ESCROW_FUNDED', order.id);
  },
  isFunded(orderId: string) { return Boolean(finance.holds[orderId]); },
  settle(order: Order, outcome: 'BUYER_REFUNDED' | 'SELLER_PAID' | 'SPLIT') {
    const hold = finance.holds[order.id];
    if (!hold || hold.amountKobo !== kobo(order.totalAmount)) throw new Error('Escrow has no matching unsettled funds');
    const refund = outcome === 'BUYER_REFUNDED' ? hold.amountKobo : outcome === 'SPLIT' ? Math.floor(hold.amountKobo / 2) : 0;
    const fee = outcome === 'SELLER_PAID' ? Math.round(order.escrowFee * 100) : 0;
    const payout = hold.amountKobo - refund - fee;
    for (const [recipient, amount] of [[order.buyerId, refund], [order.sellerId, payout], ['platform:fees', fee]] as const) {
      if (amount) {
        finance.balances[recipient] = (finance.balances[recipient] || 0) + amount;
        entry(`escrow:${order.id}`, recipient, amount, outcome, order.id);
      }
    }
    delete finance.holds[order.id];
  },
};
