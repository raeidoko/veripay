import {
  Product,
  Order,
  PurchaseSnapshot,
  Dispute,
  RiskAssessment,
  IdentityLink,
  TrustProfile,
  TrustChallenge,
  DispatchContact,
  DeliveryVerification,
  AuditLogEntry,
  UserProfile,
  ProductReviewSummary,
  AdminControlState, AdminUserProfile, PlatformSettings, VerificationDocument,
} from '../shared/types.ts';

const API_BASE = '/api';
let sessionRevision = 0;

export function invalidateSessionRequests() { sessionRevision += 1; }

async function sessionFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const revision = sessionRevision;
  const response = await fetch(input, { ...init, credentials: 'same-origin' });
  if (revision !== sessionRevision) throw new Error('Account changed while loading');
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('veripay:session-expired'));
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return response;
}

export const api = {
  async getWallet(): Promise<{available:number;held:number;currency:string;mode:string}> {
    return (await sessionFetch('/api/wallet')).json();
  },
  async topupWallet(amount: number): Promise<{available:number;held:number;currency:string;mode:string}> {
    return (await sessionFetch('/api/wallet/topup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount})})).json();
  },
  async registerAccount(input: {name:string;email:string;phone:string;password:string;role:'buyer'|'seller'}): Promise<UserProfile> {
    const response = await fetch('/api/auth/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not create account');
    return result.user;
  },
  async getAdminUserProfile(userId: string): Promise<AdminUserProfile> {
    return (await sessionFetch(`/api/admin/users/${encodeURIComponent(userId)}/profile`)).json();
  },
  async getAdminControl(): Promise<AdminControlState> { return (await sessionFetch('/api/admin/control')).json(); },
  async adminAction(path: string, data: unknown): Promise<void> {
    await sessionFetch('/api/admin/' + path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  },
  async getVerification(): Promise<{user: UserProfile; documents: VerificationDocument[]}> { return (await sessionFetch('/api/verification')).json(); },
  async uploadVerification(file: File, kind: string): Promise<VerificationDocument> {
    const response = await sessionFetch('/api/verification/documents', {method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Document-Type':kind},body:file});
    return response.json();
  },
  async getPlatform(): Promise<Pick<PlatformSettings,'announcement'|'purchasesPaused'>> { return (await sessionFetch('/api/platform')).json(); },
  async signIn(email: string, password: string): Promise<UserProfile> {
    const response = await fetch(API_BASE + '/auth/login', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not sign in');
    return result.user;
  },
  async getSession(): Promise<UserProfile | null> {
    const response = await fetch(API_BASE + '/auth/me', {credentials: 'same-origin', cache: 'no-store'});
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Could not check your session');
    return (await response.json()).user;
  },
  async signOut(): Promise<void> {
    const response = await fetch(API_BASE + '/auth/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Could not sign out. Please try again.');
  },
  async getDemoAccounts(): Promise<{accounts: {email: string; name: string; role: string}[]; demoPassword: string | null}> {
    const response = await fetch(API_BASE + '/auth/demo-accounts', {cache: 'no-store'});
    if (!response.ok) throw new Error('Could not load demo accounts');
    return response.json();
  },
  async uploadProductImage(file: File): Promise<string> {
    const response = await sessionFetch(`${API_BASE}/seller/product-images`, {
      method: 'POST', headers: { 'Content-Type': file.type }, body: file,
    });
    return (await response.json()).imageUrl;
  },

  async updateProductImage(productId: string, imageUrl: string): Promise<Product> {
    const response = await sessionFetch(`${API_BASE}/seller/products/${encodeURIComponent(productId)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { imageUrl } }),
    });
    return response.json();
  },
  async getProductReviews(productId: string): Promise<ProductReviewSummary> {
    const response = await sessionFetch(`${API_BASE}/products/${encodeURIComponent(productId)}/reviews`);
    return response.json();
  },

  async saveProductReview(productId: string, rating: number, comment: string): Promise<ProductReviewSummary> {
    const response = await sessionFetch(`${API_BASE}/products/${encodeURIComponent(productId)}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    });
    return response.json();
  },
  async getUsers(): Promise<UserProfile[]> {
    const res = await sessionFetch(`${API_BASE}/users`);
    return res.json();
  },

  async getProducts(params?: { category?: string; query?: string; sellerId?: string }): Promise<Product[]> {
    const url = new URL(`${window.location.origin}${API_BASE}/products`);
    if (params?.category) url.searchParams.set('category', params.category);
    if (params?.query) url.searchParams.set('query', params.query);
    if (params?.sellerId) url.searchParams.set('sellerId', params.sellerId);
    const res = await sessionFetch(url.toString());
    return res.json();
  },

  async getProductById(id: string): Promise<Product> {
    const res = await sessionFetch(`${API_BASE}/products/${id}`);
    return res.json();
  },

  async createProduct(data: any): Promise<Product> {
    const res = await sessionFetch(`${API_BASE}/seller/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async assistantSearch(query: string): Promise<{
    answer: string;
    recommendedProductIds: string[];
    suggestedFilters?: string[];
  }> {
    const res = await sessionFetch(`${API_BASE}/assistant/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    return res.json();
  },

  async getOrders(userId?: string, role?: string): Promise<Order[]> {
    const url = new URL(`${window.location.origin}${API_BASE}/orders`);
    if (userId) url.searchParams.set('userId', userId);
    if (role) url.searchParams.set('role', role);
    const res = await sessionFetch(url.toString());
    return res.json();
  },

  async getOrderDetails(id: string): Promise<{
    order: Order;
    snapshot?: PurchaseSnapshot;
    dispatchContact?: DispatchContact;
    verifications: DeliveryVerification[];
  }> {
    const res = await sessionFetch(`${API_BASE}/orders/${id}`);
    return res.json();
  },

  async createOrder(data: any): Promise<Order> {
    const res = await sessionFetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getConfirmationPrompt(orderId: string): Promise<{
    headline: string;
    summaryText: string;
    keyCheckpoints: string[];
    escrowNote: string;
  }> {
    const res = await sessionFetch(`${API_BASE}/orders/${orderId}/confirmation-prompt`, {
      method: 'POST',
    });
    return res.json();
  },

  async confirmPurchase(orderId: string, buyerResponse: string, confirmationText: string): Promise<PurchaseSnapshot> {
    const res = await sessionFetch(`${API_BASE}/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerResponse, confirmationText }),
    });
    return res.json();
  },

  async payEscrow(orderId: string): Promise<Order> {
    const res = await sessionFetch(`${API_BASE}/orders/${orderId}/pay`, {
      method: 'POST',
    });
    return res.json();
  },

  async saveDispatchContact(orderId: string, contactData: any): Promise<DispatchContact> {
    const res = await sessionFetch(`${API_BASE}/orders/${orderId}/dispatch-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save dispatch contact');
    return data;
  },

  async dispatchOrder(orderId: string, sellerId: string): Promise<Order> {
    const res = await sessionFetch(`${API_BASE}/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Dispatch rejected');
    return data;
  },

  async confirmDelivery(orderId: string, buyerId: string): Promise<Order> {
    const res = await sessionFetch(`${API_BASE}/orders/${orderId}/delivery-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId }),
    });
    return res.json();
  },

  async getDisputes(): Promise<Dispute[]> {
    const res = await sessionFetch(`${API_BASE}/disputes`);
    return res.json();
  },

  async getDisputeById(id: string): Promise<Dispute> {
    const res = await sessionFetch(`${API_BASE}/disputes/${id}`);
    return res.json();
  },

  async openDispute(data: any): Promise<Dispute> {
    const res = await sessionFetch(`${API_BASE}/disputes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to open dispute');
    return result;
  },

  async addEvidence(disputeId: string, evidenceData: any) {
    const res = await sessionFetch(`${API_BASE}/disputes/${disputeId}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidenceData),
    });
    return res.json();
  },

  async respondToInfoRequest(disputeId: string, requestId: string, responseText: string) {
    const res = await sessionFetch(`${API_BASE}/disputes/${disputeId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, responseText }),
    });
    return res.json();
  },

  async recordDeliveryVerification(disputeId: string, data: any): Promise<DeliveryVerification> {
    const res = await sessionFetch(`${API_BASE}/disputes/${disputeId}/delivery-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async decideDispute(disputeId: string, data: any): Promise<Dispute> {
    const res = await sessionFetch(`${API_BASE}/disputes/${disputeId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getRiskQueue(): Promise<{ assessments: RiskAssessment[]; links: IdentityLink[] }> {
    const res = await sessionFetch(`${API_BASE}/admin/risk/queue`);
    return res.json();
  },

  async resolveRisk(assessmentId: string, data: any): Promise<RiskAssessment> {
    const res = await sessionFetch(`${API_BASE}/admin/risk/${assessmentId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async decideIdentityLink(linkId: string, data: any): Promise<IdentityLink> {
    const res = await sessionFetch(`${API_BASE}/admin/risk/links/${linkId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getTrustPassport(userId: string): Promise<TrustProfile> {
    const res = await sessionFetch(`${API_BASE}/users/${userId}/passport`);
    return res.json();
  },

  async getPassportFactors(userId: string): Promise<{ profile: TrustProfile; events: any[] }> {
    const res = await sessionFetch(`${API_BASE}/me/passport/factors?userId=${userId}`);
    return res.json();
  },

  async challengeTrustRecord(data: any): Promise<TrustChallenge> {
    const res = await sessionFetch(`${API_BASE}/me/passport/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async decideTrustChallenge(challengeId: string, data: any): Promise<TrustChallenge> {
    const res = await sessionFetch(`${API_BASE}/admin/passport/challenges/${challengeId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await sessionFetch(`${API_BASE}/audit-logs`);
    return res.json();
  },
};
