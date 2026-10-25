import type { UserRole } from './types.ts';

export type WorkspaceTab = 'catalog' | 'orders' | 'disputes' | 'risk' | 'passport' | 'audit' | 'seller_store' | 'admin' | 'verification';

export const workspaces: Record<UserRole, {
  title: string;
  home: WorkspaceTab;
  tabs: { id: WorkspaceTab; label: string }[];
  ordersTitle: string;
  ordersDescription: string;
}> = {
  buyer: {
    title: 'Buyer workspace', home: 'catalog',
    tabs: [{ id: 'catalog', label: 'Shop' }, { id: 'orders', label: 'My Purchases' }, { id: 'disputes', label: 'My Disputes' }, { id: 'passport', label: 'My Trust Passport' }, { id: 'verification', label: 'Verification' }],
    ordersTitle: 'My Purchases',
    ordersDescription: 'Review your purchases, secure payments in escrow, track delivery, and report an issue with your order.',
  },
  seller: {
    title: 'Seller workspace', home: 'seller_store',
    tabs: [{ id: 'seller_store', label: 'My Storefront' }, { id: 'orders', label: 'Sales & Dispatch' }, { id: 'disputes', label: 'My Disputes' }, { id: 'passport', label: 'My Trust Passport' }, { id: 'verification', label: 'Verification' }],
    ordersTitle: 'Sales & Dispatch',
    ordersDescription: 'Manage your customer orders, register courier details, and dispatch purchases with secured escrow payments.',
  },
  admin: {
    title: 'Admin workspace', home: 'admin',
    tabs: [{ id: 'admin', label: 'Control Centre' }, { id: 'risk', label: 'Risk Shield' }, { id: 'disputes', label: 'Disputes' }, { id: 'orders', label: 'Transactions' }, { id: 'passport', label: 'Trust Registry' }, { id: 'audit', label: 'Audit Trail' }],
    ordersTitle: 'Transaction Oversight',
    ordersDescription: 'Monitor platform transactions and risk holds. Use Risk Shield to investigate identity links and resolve flags.',
  },
};
