import { DispatchContact, DeliveryVerification } from '../../shared/types.ts';
import { dispatchContacts, deliveryVerifications, orders, disputes } from '../db/store.ts';
import { auditLogService } from './auditLogService.ts';
import { evidenceService } from './evidenceService.ts';
import { choice, text } from '../utils/validation.ts';

// Nigerian phone validation helper: matches +234..., 234..., or 070..., 080..., 081..., 090..., 091...
export function validateNigerianPhone(phone: string): boolean {
  if (typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+?234|0)[789][01]\d{8}$/.test(cleaned);
}

export const dispatchService = {
  getContactByOrderId(orderId: string): DispatchContact | undefined {
    return dispatchContacts.find((c) => c.orderId === orderId);
  },

  getVerificationsByOrderId(orderId: string): DeliveryVerification[] {
    return deliveryVerifications.filter((v) => v.orderId === orderId);
  },

  saveDispatchContact(
    orderId: string,
    sellerId: string,
    sellerName: string,
    data: {
      type: 'RIDER' | 'COMPANY';
      name: string;
      phone: string;
      email?: string;
      trackingNumber?: string;
      vehicleNotes?: string;
    }
  ): { success: boolean; contact?: DispatchContact; error?: string } {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.sellerId !== sellerId) return {success:false,error:'Only the seller can register dispatch contact'};
    if (order.state !== 'PAYMENT_SECURED') return {success:false,error:'Register dispatch contact only after payment is secured'};
    if (!['RIDER','COMPANY'].includes(data.type)) return {success:false,error:'Choose rider or company'};

    // Validation rules
    if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.length > 150) {
      return { success: false, error: 'Rider or company name is required' };
    }

    if (!validateNigerianPhone(data.phone)) {
      return {
        success: false,
        error: 'Invalid Nigerian phone number. Format should be +234803XXXXXXX or 0803XXXXXXX.',
      };
    }

    if (data.type === 'COMPANY' && !data.phone && !data.email) {
      return { success: false, error: 'Logistics company requires phone number or valid contact email' };
    }

    // Check if contact already exists for this order, otherwise create
    let contact = dispatchContacts.find((c) => c.orderId === orderId);
    if (contact) {
      contact.type = data.type;
      contact.name = data.name;
      contact.phone = data.phone;
      contact.email = data.email;
      contact.trackingNumber = data.trackingNumber;
      contact.vehicleNotes = data.vehicleNotes;
      contact.addedAt = new Date().toISOString();
    } else {
      contact = {
        id: `disp_${order.id}_${Date.now()}`,
        orderId: order.id,
        type: data.type,
        name: data.name,
        phone: data.phone,
        email: data.email,
        trackingNumber: data.trackingNumber || `VP-LOG-${Date.now().toString().slice(-5)}`,
        vehicleNotes: data.vehicleNotes,
        addedBy: sellerId,
        addedAt: new Date().toISOString(),
      };
      dispatchContacts.push(contact);
    }

    order.dispatchContactId = contact.id;

    auditLogService.log({
      actorId: sellerId,
      actorName: sellerName,
      actorRole: 'seller',
      action: 'DISPATCH_CONTACT_VERIFIED_AND_SAVED',
      entityType: 'DISPATCH',
      entityId: contact.id,
      changesSummary: `Dispatch contact registered for Order ${order.orderNumber}: ${data.type} "${data.name}" (${data.phone}). Dispatch unlock enabled.`,
    });

    return { success: true, contact };
  },

  /**
   * Records independent delivery verification result (called by reviewer or automated dispatch workflow)
   */
  recordDeliveryVerification(
    orderId: string,
    params: {
      contactId: string;
      requestedBy: string;
      agentName: string;
      method: 'AUTOMATED_SMS_CALL' | 'REVIEWER_PHONE_CALL';
      outcome: 'CONFIRMED_DELIVERED' | 'NOT_DELIVERED' | 'UNREACHABLE';
      notes: string;
      disputeId?: string;
    }
  ): DeliveryVerification {
    const contact = dispatchContacts.find((c) => c.id === params.contactId);
    if (!contact || contact.orderId !== orderId) throw new Error('Dispatch contact does not belong to this order');
    const dispute = disputes.find(dispute => dispute.id === params.disputeId && dispute.orderId === orderId);
    if (!dispute || ['DECIDED','CLOSED'].includes(dispute.state)) throw new Error('Delivery verification requires an active dispute');
    choice(params.method, ['AUTOMATED_SMS_CALL','REVIEWER_PHONE_CALL'], 'verification method');
    choice(params.outcome, ['CONFIRMED_DELIVERED','NOT_DELIVERED','UNREACHABLE'], 'delivery outcome');
    params.notes = text(params.notes, 'Verification notes', 3, 5000);
    if (params.method === 'AUTOMATED_SMS_CALL') throw new Error('Automated SMS and calls are not configured; record a reviewer phone call instead');
    const verification: DeliveryVerification = {
      id: `dver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId,
      disputeId: params.disputeId,
      contactId: params.contactId,
      contactName: contact ? `${contact.name} (${contact.type})` : 'Courier Contact',
      contactPhone: contact ? contact.phone : 'N/A',
      requestedBy: params.requestedBy,
      method: params.method,
      outcome: params.outcome,
      notes: params.notes,
      verifiedAt: new Date().toISOString(),
      agentName: params.agentName,
    };

    deliveryVerifications.push(verification);

    // If attached to a dispute, automatically append as tamper-evident evidence item
    if (params.disputeId) {
      evidenceService.addEvidenceToDispute({
        disputeId: params.disputeId,
        party: 'REVIEWER',
        type: 'DELIVERY_VERIFICATION',
        title: `F6 Independent Dispatch Verification (${verification.outcome})`,
        description: `Verified via Reviewer Contact: ${params.notes}`,
      });
    }

    auditLogService.log({
      actorId: params.requestedBy,
      actorName: params.agentName,
      actorRole: 'admin',
      action: 'DELIVERY_VERIFICATION_RECORDED',
      entityType: 'DISPATCH',
      entityId: verification.id,
      changesSummary: `Delivery verification recorded for Order ${orderId}: Outcome=${verification.outcome}. Notes: ${verification.notes}`,
    });

    return verification;
  },
};
