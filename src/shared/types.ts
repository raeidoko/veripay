/**
 * VeriPay Platform Types
 * Architecture: F1 to F6
 */

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface UserProfile {
  accountStatus?: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
  approvalNotes?: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  isRestricted?: boolean;
  restrictionReason?: string;
  identityVerified: boolean;
  identityMethods: string[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceDelta: number;
  stock: number;
}

export interface Product {
  moderationStatus?: 'PENDING' | 'PUBLISHED' | 'HIDDEN';
  moderationNotes?: string;
  id: string;
  name: string;
  category: string;
  description: string;
  price: number; // in NGN
  currency: 'NGN' | 'USD';
  stock: number;
  sellerId: string;
  sellerName: string;
  sellerPassportLevel: 'BRONZE' | 'SILVER' | 'GOLD' | 'CROWN';
  sellerIdentityVerified: boolean;
  imageUrl: string;
  deliveryTerms: string;
  estimatedDays: number;
  variants: ProductVariant[];
  rating: number;
  reviewsCount: number;
  created_at: string;
}

export interface ProductReview {
  hidden?: boolean;
  id: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewSummary {
  reviews: ProductReview[];
  rating: number;
  reviewsCount: number;
}

export interface CartItem {
  productId: string;
  product: Product;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

export type OrderState =
  | 'DRAFT'
  | 'AWAITING_CONFIRMATION' // F2
  | 'PENDING_PAYMENT'
  | 'RISK_HOLD'             // F4
  | 'PAYMENT_SECURED'       // Escrow locked
  | 'DISPATCHED'            // F6 requires contact
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'             // F3
  | 'REFUNDED'
  | 'CANCELLED';

export interface OrderItem {
  productId: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  sellerId: string;
  sellerName: string;
  items: OrderItem[];
  subtotal: number;
  escrowFee: number;
  totalAmount: number;
  currency: 'NGN' | 'USD';
  state: OrderState;
  deliveryAddress: string;
  deliveryTerms: string;
  purchaseSnapshotId?: string;
  confirmationText?: string;
  dispatchedAt?: string;
  expectedDeliveryAt?: string;
  dispatchContactId?: string;
  hasRiskFlag?: boolean;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CONFIRMED';
  createdAt: string;
  updatedAt: string;
}

// F2: Purchase Snapshot
export interface PurchaseSnapshot {
  id: string;
  orderId: string;
  payload: {
    productSummary: {
      name: string;
      variant?: string;
      quantity: number;
      unitPrice: number;
      total: number;
      imageUrl: string;
    }[];
    totalAmount: number;
    currency: string;
    escrowFee: number;
    sellerId: string;
    sellerName: string;
    sellerVerificationStatus: string;
    buyerId: string;
    buyerName: string;
    deliveryAddress: string;
    deliveryTerms: string;
    timestamp: string;
    confirmation?: { text: string; response: string };
  };
  sha256: string;
  confirmedAt: string;
  confirmationText: string;
  buyerResponse: string;
}

// F3: Disputes
export type DisputeState =
  | 'OPENED'
  | 'EVIDENCE_COLLECTION'
  | 'AI_ANALYSIS'
  | 'REVIEWER_APPROVAL' // Fast lane
  | 'REVIEWER_QUEUE'    // Complex lane
  | 'DECIDED'
  | 'APPEAL_WINDOW'
  | 'CLOSED';

export type DisputeOutcome = 'BUYER_REFUNDED' | 'SELLER_PAID' | 'SPLIT';

export interface EvidenceItem {
  id: string;
  disputeId: string;
  party: 'BUYER' | 'SELLER' | 'SYSTEM' | 'REVIEWER';
  type: 'PURCHASE_SNAPSHOT' | 'PHOTO' | 'WAYBILL' | 'RIDER_LOG' | 'CHAT_EXPORT' | 'DELIVERY_VERIFICATION';
  title: string;
  description: string;
  url?: string;
  sha256: string;
  uploadedAt: string;
}

export interface AIRecommendation {
  id: string;
  disputeId: string;
  modelVersion: string;
  findings: string[];
  inconsistencies: string[];
  recommendedOutcome: DisputeOutcome | 'NEEDS_REVIEW';
  source?: 'ai' | 'rules';
  infoRequests?: { requestedFrom: 'BUYER' | 'SELLER'; question: string }[];
  confidence: number; // 0 to 1
  rationale: string;
  suggestedSplit?: { buyerPercentage: number; sellerPercentage: number };
  createdAt: string;
}

export interface InfoRequest {
  id: string;
  disputeId: string;
  requestedFrom: 'BUYER' | 'SELLER';
  question: string;
  response?: string;
  dueAt: string;
  createdAt: string;
  status: 'PENDING' | 'ANSWERED';
}

export interface Dispute {
  id: string;
  orderId: string;
  orderNumber: string;
  openedBy: 'BUYER' | 'SELLER';
  openerName: string;
  reason: 'NON_DELIVERY' | 'ITEM_NOT_AS_DESCRIBED' | 'COUNTERFEIT_SUSPICION' | 'DAMAGED_IN_TRANSIT';
  details: string;
  state: DisputeState;
  claimedAmount: number;
  fastLaneEligible: boolean;
  decidedBy?: string;
  decision?: DisputeOutcome;
  decisionRationale?: string;
  decidedAt?: string;
  createdAt: string;
  evidence: EvidenceItem[];
  aiRecommendation?: AIRecommendation;
  infoRequests: InfoRequest[];
}

// F4: Risk Detection & Identity Linking
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CONFIRMED';
export type IdentityAttributeType = 'PHONE' | 'DEVICE' | 'BANK_NAME' | 'ID_REF' | 'ADDRESS';

export interface IdentityAttribute {
  id: string;
  userId: string;
  type: IdentityAttributeType;
  rawHint: string;
  hashedValue: string;
  createdAt: string;
}

export interface IdentityLink {
  id: string;
  userA: string;
  userB: string;
  userAName: string;
  userBName: string;
  matchedAttribute: IdentityAttributeType;
  matchDetails: string;
  status: 'SUSPECTED' | 'CONFIRMED' | 'CLEARED';
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskAssessment {
  id: string;
  subjectType: 'ORDER' | 'USER';
  subjectId: string;
  score: number; // 0 - 100
  level: RiskLevel;
  reasons: string[];
  modelVersion: string;
  createdAt: string;
  state: 'ACTIVE' | 'HELD' | 'CLEARED' | 'RESTRICTED';
  assignedReviewer?: string;
  resolutionNotes?: string;
}

// F5: Trust Passport 2.0
export type TrustPassportLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'CROWN';

export interface TrustFactors {
  verifiedTransactions: number;
  onTimeDeliveryRate: number; // percentage 0-100
  cooperationScore: number;   // percentage 0-100 (response time to buyers & AI inquiries)
  substantiatedDisputes: number;
  unprovenComplaintsExcluded: number;
  accountAgeDays: number;
  dispatchVerifiedCount: number;
}

export interface TrustProfile {
  userId: string;
  userName: string;
  level: TrustPassportLevel;
  reliabilityScore: number; // 0-100
  factors: TrustFactors;
  updatedAt: string;
  identityVerified: boolean;
  identityCheckMethod: string;
}

export interface TrustEvent {
  id: string;
  userId: string;
  type: 'TRANSACTION_COMPLETED' | 'DELIVERY_VERIFIED' | 'DISPUTE_SUBSTANTIATED' | 'DISPUTE_UNPROVEN_CLEARED' | 'COOPERATION_RECORD';
  orderId?: string;
  weight: number;
  verified: boolean;
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'REVOKED';
  description: string;
  timestamp: string;
}

export interface TrustChallenge {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  reason: string;
  state: 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED_REMOVED' | 'RESOLVED_UPHELD';
  decidedBy?: string;
  decisionNotes?: string;
  createdAt: string;
}

// F6: Dispatch Verification
export interface DispatchContact {
  id: string;
  orderId: string;
  type: 'RIDER' | 'COMPANY';
  name: string;
  phone: string;
  email?: string;
  trackingNumber?: string;
  vehicleNotes?: string;
  addedBy: string;
  addedAt: string;
}

export interface DeliveryVerification {
  id: string;
  orderId: string;
  disputeId?: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  requestedBy: string;
  method: 'AUTOMATED_SMS_CALL' | 'REVIEWER_PHONE_CALL';
  outcome: 'CONFIRMED_DELIVERED' | 'NOT_DELIVERED' | 'UNREACHABLE' | 'PENDING';
  notes: string;
  verifiedAt?: string;
  agentName?: string;
}

// Append-Only Audit Log
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | 'SYSTEM' | 'AI_ENGINE';
  action: string;
  entityType: 'ORDER' | 'DISPUTE' | 'SNAPSHOT' | 'RISK' | 'TRUST' | 'DISPATCH' | 'AUTH' | 'USER' | 'DOCUMENT' | 'PRODUCT' | 'PLATFORM' | 'REVIEW';
  entityId: string;
  changesSummary: string;
  sha256Hash: string;
}

export interface VerificationDocument {
  id: string; userId: string; userName: string;
  kind: 'IDENTITY' | 'BUSINESS' | 'ADDRESS' | 'OTHER';
  originalName: string; filename: string; mimeType: string; size: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: string; reviewedAt?: string; reviewedBy?: string; notes?: string;
}

export interface PlatformSettings {
  purchasesPaused: boolean;
  requireProductApproval: boolean;
  announcement: string;
}

export interface AdminControlState {
  users: UserProfile[];
  documents: VerificationDocument[];
  products: Product[];
  reviews: ProductReview[];
  settings: PlatformSettings;
  totals: { users: number; pendingUsers: number; pendingDocuments: number; pendingProducts: number; orders: number; escrowHeld: number; openDisputes: number };
}

export interface AdminUserProfile {
  user: UserProfile;
  documents: VerificationDocument[];
  products: Product[];
  reviewsWritten: ProductReview[];
  reviewsReceived: ProductReview[];
  orders: Order[];
  disputes: Dispute[];
  activity: AuditLogEntry[];
}
