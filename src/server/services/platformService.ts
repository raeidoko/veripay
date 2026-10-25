import { randomUUID } from 'node:crypto';
import './registrationService.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AdminUserProfile, AuditLogEntry, PlatformSettings, Product, UserProfile, VerificationDocument } from '../../shared/types.ts';
import { users, products, orders, disputes, auditLogs, trustProfiles } from '../db/store.ts';
import { auditLogService } from './auditLogService.ts';
import { productReviewService } from './productReviewService.ts';
import { registerState, hasSavedState } from '../db/persistence.ts';
import { governancePath } from '../config.ts';

export const governanceDirectory = governancePath;
const stateFile = path.join(governanceDirectory, 'state.json');
type State = {
  createdProducts?: Product[];
  users: Record<string, { accountStatus: UserProfile['accountStatus']; approvalNotes: string }>;
  products: Record<string, { moderationStatus: 'PENDING' | 'PUBLISHED' | 'HIDDEN'; moderationNotes: string }>;
  documents: VerificationDocument[]; settings: PlatformSettings; events: AuditLogEntry[];
};
const state: State = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {
  users: {}, products: {}, documents: [], events: [],
  settings: { purchasesPaused: false, requireProductApproval: true, announcement: '' },
};
registerState('governance', state);
for (const restored of hasSavedState('products') ? [] : state.createdProducts || []) {
  const index = products.findIndex(product => product.id === restored.id);
  if (index < 0) products.push(restored); else products[index] = restored;
}
for (const user of users) Object.assign(user, state.users[user.id] || { accountStatus: user.accountStatus || 'APPROVED' });
for (const product of products) Object.assign(product, state.products[product.id] || { moderationStatus: 'PUBLISHED' });
for (const event of state.events) if (!auditLogs.some(item => item.id === event.id)) auditLogs.push(event);

function persist() {
  // Metadata commits with the rest of the request in the SQLite transaction.
}
function note(value: unknown) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 1000) throw new Error('Add a reason between 3 and 1,000 characters');
  return value.trim();
}
function log(actor: UserProfile, action: string, entityType: AuditLogEntry['entityType'], entityId: string, text: string) {
  state.events.push(auditLogService.log({ actorId: actor.id, actorName: actor.name, actorRole: 'admin', action, entityType, entityId, changesSummary: text }));
  persist();
}

export const platformService = {
  recordProduct(product: Product) {
    state.createdProducts = (state.createdProducts || []).filter(item => item.id !== product.id);
    state.createdProducts.push(product);
    persist();
  },
  settings() { return { ...state.settings }; },
  ownVerification(user: UserProfile) {
    return { user, documents: state.documents.filter(item => item.userId === user.id) };
  },
  userProfile(id: string): AdminUserProfile | null {
    const user = users.find(item => item.id === id);
    if (!user) return null;
    const ownProducts = products.filter(item => item.sellerId === id);
    const productIds = new Set(ownProducts.map(item => item.id));
    const ownOrders = orders.filter(item => item.buyerId === id || item.sellerId === id);
    const orderIds = new Set(ownOrders.map(item => item.id));
    const documents = state.documents.filter(item => item.userId === id).reverse();
    const ownDisputes = disputes.filter(item => orderIds.has(item.orderId));
    const reviews = productReviewService.getAll();
    const written = reviews.filter(item => item.buyerId === id);
    const received = reviews.filter(item => productIds.has(item.productId));
    const entities = new Set([id, ...productIds, ...orderIds, ...documents.map(item => item.id), ...ownDisputes.map(item => item.id), ...written.map(item => item.id), ...received.map(item => item.id)]);
    return { user, documents, products: ownProducts, reviewsWritten: written, reviewsReceived: received,
      orders: ownOrders, disputes: ownDisputes,
      activity: [...auditLogs].reverse().filter(item => item.actorId === id || entities.has(item.entityId)) };
  },
  control() {
    return {
      users, products, documents: [...state.documents].reverse(), reviews: productReviewService.getAll(), settings: this.settings(),
      totals: { users: users.length, pendingUsers: users.filter(user => user.accountStatus === 'PENDING').length,
        pendingDocuments: state.documents.filter(doc => doc.status === 'PENDING').length,
        pendingProducts: products.filter(product => product.moderationStatus === 'PENDING').length,
        orders: orders.length, escrowHeld: orders.filter(order => ['PAYMENT_SECURED', 'DISPATCHED', 'IN_TRANSIT', 'DISPUTED', 'RISK_HOLD'].includes(order.state)).reduce((sum, order) => sum + order.totalAmount, 0),
        openDisputes: disputes.filter(dispute => !['CLOSED','DECIDED'].includes(dispute.state)).length },
    };
  },
  setUserStatus(actor: UserProfile, id: string, status: unknown, reason: unknown) {
    const user = users.find(item => item.id === id);
    if (!user) throw new Error('Account not found');
    if (user.role === 'admin') throw new Error('Admin accounts cannot be changed here');
    if (!['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(String(status))) throw new Error('Invalid account status');
    const notes = note(reason);
    if (status === 'APPROVED' && user.accountStatus !== 'APPROVED' && !state.documents.some(doc => doc.userId === id && doc.kind === 'IDENTITY' && doc.status === 'APPROVED')) {
      throw new Error('Approve an identity document before approving this account');
    }
    state.users[id] = { accountStatus: status as UserProfile['accountStatus'], approvalNotes: notes };
    Object.assign(user, state.users[id]);
    log(actor, 'ACCOUNT_' + status, 'USER', id, `${user.name}: ${notes}`);
    return user;
  },
  uploadDocument(user: UserProfile, bytes: Buffer, mimeType: string, originalName: string, kind: string) {
    if (!['IDENTITY', 'BUSINESS', 'ADDRESS', 'OTHER'].includes(kind)) throw new Error('Choose a document type');
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Upload a document up to 10 MB');
    let extension = '';
    if (mimeType === 'application/pdf' && bytes.subarray(0,5).toString() === '%PDF-') extension = 'pdf';
    if (mimeType === 'image/png' && bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) extension = 'png';
    if (mimeType === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) extension = 'jpg';
    if (!extension) throw new Error('Upload a valid PDF, JPG, or PNG document');
    const id = randomUUID();
    const filename = id + '.' + extension;
    mkdirSync(path.join(governanceDirectory, 'documents'), {recursive:true});
    writeFileSync(path.join(governanceDirectory, 'documents', filename), bytes, {flag:'wx'});
    const doc: VerificationDocument = { id, userId: user.id, userName: user.name, kind: kind as VerificationDocument['kind'], originalName: path.basename(originalName).replace(/[\r\n]/g,'').slice(0,160) || ('document.' + extension), filename, mimeType, size:bytes.length, status:'PENDING', uploadedAt:new Date().toISOString() };
    state.documents.push(doc);
    state.events.push(auditLogService.log({actorId:user.id,actorName:user.name,actorRole:user.role,action:'DOCUMENT_UPLOADED',entityType:'DOCUMENT',entityId:id,changesSummary:`${kind} document submitted for admin review`}));
    persist();
    return doc;
  },
  document(id: string) { return state.documents.find(item => item.id === id); },
  reviewDocument(actor: UserProfile, id: string, status: unknown, reason: unknown) {
    const doc = this.document(id);
    if (!doc) throw new Error('Document not found');
    if (!['APPROVED','REJECTED'].includes(String(status))) throw new Error('Choose approve or reject');
    if (doc.status !== 'PENDING') throw new Error('This document has already been reviewed. Ask for a new upload if needed.');
    const notes = note(reason);
    Object.assign(doc, {status,notes,reviewedBy:actor.name,reviewedAt:new Date().toISOString()});
    if (status === 'APPROVED' && doc.kind === 'IDENTITY') {
      const user = users.find(item => item.id === doc.userId)!;
      user.identityVerified = true;
      if (!user.identityMethods.includes('DOCUMENT_REVIEW')) user.identityMethods.push('DOCUMENT_REVIEW');
      if (trustProfiles[user.id]) trustProfiles[user.id].identityVerified = true;
    }
    log(actor, 'DOCUMENT_' + status, 'DOCUMENT', id, `${doc.userName}, ${doc.kind}: ${notes}`);
    return doc;
  },
  moderateProduct(actor: UserProfile, id: string, status: unknown, reason: unknown) {
    const product = products.find(item => item.id === id);
    if (!product) throw new Error('Product not found');
    if (!['PUBLISHED', 'HIDDEN'].includes(String(status))) throw new Error('Invalid listing status');
    const notes = note(reason);
    state.products[id] = {moderationStatus:status as 'PUBLISHED'|'HIDDEN',moderationNotes:notes};
    Object.assign(product,state.products[id]);
    log(actor, 'PRODUCT_' + status, 'PRODUCT', id, `${product.name}: ${notes}`);
    return product;
  },
  moderateReview(actor: UserProfile, id: string, hidden: unknown, reason: unknown) {
    if (typeof hidden !== 'boolean') throw new Error('Invalid review visibility');
    const notes = note(reason);
    productReviewService.moderate(id,hidden);
    log(actor,hidden ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED','REVIEW',id,notes);
  },
  updateSettings(actor: UserProfile, input: unknown) {
    const value = input as PlatformSettings;
    if (!value || typeof value.purchasesPaused !== 'boolean' || typeof value.requireProductApproval !== 'boolean' || typeof value.announcement !== 'string' || value.announcement.length > 300) throw new Error('Invalid platform settings');
    state.settings = {purchasesPaused:value.purchasesPaused,requireProductApproval:value.requireProductApproval,announcement:value.announcement.trim()};
    log(actor,'PLATFORM_SETTINGS_UPDATED','PLATFORM','settings',JSON.stringify(state.settings));
    return this.settings();
  },
};
// Rehydrate manual identity decisions without treating a review as external ID verification.
for (const doc of state.documents.filter(item => item.kind === 'IDENTITY' && item.status === 'APPROVED')) {
  const user = users.find(item => item.id === doc.userId);
  if (user) { user.identityVerified = true; if (!user.identityMethods.includes('DOCUMENT_REVIEW')) user.identityMethods.push('DOCUMENT_REVIEW'); }
}
