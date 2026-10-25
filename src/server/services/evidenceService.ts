import { PurchaseSnapshot, Order, EvidenceItem } from '../../shared/types.ts';
import { purchaseSnapshots, disputes } from '../db/store.ts';
import { calculateSha256 } from '../utils/crypto.ts';
import { auditLogService } from './auditLogService.ts';
import { choice, text } from '../utils/validation.ts';

export const evidenceService = {
  createPurchaseSnapshot(
    order: Order,
    confirmationText: string,
    buyerResponse: string = 'YES_CONFIRMED'
  ): PurchaseSnapshot {
    if (purchaseSnapshots.some(snapshot => snapshot.orderId === order.id)) throw new Error('A purchase snapshot already exists for this order');
    const payload = {
      productSummary: order.items.map((item) => ({
        name: item.productName,
        variant: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.subtotal,
        imageUrl: item.imageUrl,
      })),
      totalAmount: order.totalAmount,
      currency: order.currency,
      escrowFee: order.escrowFee,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
      sellerVerificationStatus: 'Verified Merchant',
      buyerId: order.buyerId,
      buyerName: order.buyerName,
      deliveryAddress: order.deliveryAddress,
      deliveryTerms: order.deliveryTerms,
      timestamp: new Date().toISOString(),
      confirmation: { text: confirmationText, response: buyerResponse },
    };

    const sha256 = calculateSha256(payload);

    const snapshot: PurchaseSnapshot = {
      id: `snap_${order.id}_${Date.now()}`,
      orderId: order.id,
      payload,
      sha256,
      confirmedAt: payload.timestamp,
      confirmationText,
      buyerResponse,
    };

    purchaseSnapshots.push(snapshot);

    auditLogService.log({
      actorId: order.buyerId,
      actorName: order.buyerName,
      actorRole: 'buyer',
      action: 'PURCHASE_SNAPSHOT_SEALED',
      entityType: 'SNAPSHOT',
      entityId: snapshot.id,
      changesSummary: `Sealed tamper-evident Purchase Snapshot for Order ${order.orderNumber}. SHA-256: ${sha256.substring(0, 16)}...`,
    });

    return snapshot;
  },

  getSnapshotByOrderId(orderId: string): PurchaseSnapshot | undefined {
    return purchaseSnapshots.find((s) => s.orderId === orderId);
  },
  verifySnapshot(orderId: string): boolean {
    const snapshot = this.getSnapshotByOrderId(orderId);
    return Boolean(snapshot && snapshot.sha256 === calculateSha256(snapshot.payload));
  },

  addEvidenceToDispute(params: {
    disputeId: string;
    party: 'BUYER' | 'SELLER' | 'SYSTEM' | 'REVIEWER';
    type: 'PURCHASE_SNAPSHOT' | 'PHOTO' | 'WAYBILL' | 'RIDER_LOG' | 'CHAT_EXPORT' | 'DELIVERY_VERIFICATION';
    title: string;
    description: string;
    url?: string;
  }): EvidenceItem {
    const dispute = disputes.find((d) => d.id === params.disputeId);
    if (!dispute) throw new Error('Dispute not found');
    if (['DECIDED','CLOSED'].includes(dispute.state)) throw new Error('This dispute has already been decided');
    choice(params.type, ['PURCHASE_SNAPSHOT','PHOTO','WAYBILL','RIDER_LOG','CHAT_EXPORT','DELIVERY_VERIFICATION'], 'evidence type');
    if (params.party !== 'REVIEWER' && ['PURCHASE_SNAPSHOT','DELIVERY_VERIFICATION'].includes(params.type)) throw new Error('This evidence type is reserved for the system or reviewer');
    params.title = text(params.title, 'Evidence title', 2, 200);
    params.description = text(params.description, 'Evidence description', 3, 5000);
    if (params.url && (typeof params.url !== 'string' || params.url.length > 2000 || !/^https?:\/\//i.test(params.url))) throw new Error('Evidence links must use HTTP or HTTPS');

    const uploadedAt = new Date().toISOString();
    const sha256 = calculateSha256({
      disputeId: params.disputeId,
      party: params.party,
      type: params.type,
      title: params.title,
      description: params.description,
      url: params.url,
      uploadedAt,
    });

    const item: EvidenceItem = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      disputeId: params.disputeId,
      party: params.party,
      type: params.type,
      title: params.title,
      description: params.description,
      url: params.url,
      sha256,
      uploadedAt,
    };

    dispute.evidence.push(item);

    auditLogService.log({
      actorId: params.party.toLowerCase(),
      actorName: `${params.party} Upload`,
      actorRole: params.party === 'BUYER' ? 'buyer' : params.party === 'SELLER' ? 'seller' : 'admin',
      action: 'EVIDENCE_ITEM_SUBMITTED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      changesSummary: `New evidence item [${item.type}] submitted: "${item.title}". Hash: ${sha256.substring(0, 12)}...`,
    });

    return item;
  },
};
