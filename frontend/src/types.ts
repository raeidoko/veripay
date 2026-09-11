/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_SECURED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'REFUNDED';

export interface TimelineEvent {
  id: string;
  status: TransactionStatus;
  title: string;
  description: string;
  timestamp: string;
  actor: 'BUYER' | 'SELLER' | 'SYSTEM' | 'LOGISTICS';
}

export interface SellerProfile {
  id: string;
  name: string;
  handle: string;
  phone: string;
  category: string;
  trustScore: number; // 0 to 100
  successfulSales: number;
  activeEscrows: number;
  disputeCount: number;
  responseTime: string; // e.g., "15 mins"
  rating: number; // 0 to 5
}

export interface Transaction {
  id: string; // e.g., "VP-48293"
  productName: string;
  category: string;
  amount: number; // in Nigerian naira (NGN)
  sellerId: string;
  sellerName: string;
  sellerHandle: string;
  sellerPhone: string;
  buyerName: string;
  buyerPhone: string;
  deliveryPartner: string; // e.g., "GIG Logistics", "DHL", "Fez Delivery"
  trackingNumber: string;
  deliveryTimelineDays: number;
  terms: string;
  status: TransactionStatus;
  createdAt: string;
  timeline: TimelineEvent[];
  dispute?: Dispute;
  qrCodeUrl?: string;
}

export interface Dispute {
  id: string;
  openedBy: 'BUYER' | 'SELLER';
  reason: string;
  description: string;
  buyerEvidence: EvidenceFile[];
  sellerEvidence: EvidenceFile[];
  buyerMessage?: string;
  sellerMessage?: string;
  arbitrationStatus: 'PENDING' | 'UNDER_REVIEW' | 'BUYER_REFUNDED' | 'SELLER_PAID';
  verdictDescription?: string;
  createdAt: string;
}

export interface EvidenceFile {
  id: string;
  type: 'image' | 'document' | 'video';
  name: string;
  url: string;
}

export interface Notification {
  id: string;
  transactionId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}
