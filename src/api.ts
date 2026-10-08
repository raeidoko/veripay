import { AuthUser, Notification, SellerProfile, Transaction } from './types';

export interface VeriPayState {
  transactions: Transaction[];
  notifications: Notification[];
  updatedAt?: string;
  revision?: string;
}

type DisputeVerdict = 'BUYER_REFUNDED' | 'SELLER_PAID';

const AUTH_TOKEN_KEY = 'veripay_auth_token';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`VeriPay API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function login(phone: string, password: string) {
  return request<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
}

export function loadCurrentUser() {
  return request<{ user: AuthUser }>('/api/auth/me');
}

export function loadVeriPayState() {
  return request<VeriPayState>('/api/state');
}

export function saveVeriPayState(state: VeriPayState) {
  return request<VeriPayState>('/api/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  });
}

export function loadSellers() {
  return request<{ sellers: SellerProfile[] }>('/api/sellers');
}

export function createTransaction(txData: Partial<Transaction>) {
  return request<VeriPayState>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(txData),
  });
}

export function createQrTransaction(sellerId: string) {
  return request<VeriPayState>('/api/transactions/qr', {
    method: 'POST',
    body: JSON.stringify({ sellerId }),
  });
}

export function payEscrow(transactionId: string) {
  return request<VeriPayState>(`/api/transactions/${transactionId}/pay`, {
    method: 'POST',
  });
}

export function confirmDelivery(transactionId: string) {
  return request<VeriPayState>(`/api/transactions/${transactionId}/confirm-delivery`, {
    method: 'POST',
  });
}

export function fileDispute(transactionId: string, reason: string, description: string) {
  return request<VeriPayState>(`/api/transactions/${transactionId}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reason, description }),
  });
}

export function resolveDispute(transactionId: string, verdict: DisputeVerdict) {
  return request<VeriPayState>(`/api/transactions/${transactionId}/resolve-dispute`, {
    method: 'POST',
    body: JSON.stringify({ verdict }),
  });
}

export function markNotificationRead(notificationId: string) {
  return request<VeriPayState>(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export function clearNotifications() {
  return request<VeriPayState>('/api/notifications', {
    method: 'DELETE',
  });
}
