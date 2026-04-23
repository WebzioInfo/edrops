import { useState, useCallback } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

function getToken(): string | null {
  return localStorage.getItem('edrops_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? 'Something went wrong');
  }

  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(url: string, data: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};

export function useFetch<T>(
  endpoint: string,
): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });

  const fetch = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    api.get<T>(endpoint)
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err => setState({ data: null, loading: false, error: err.message }));
  }, [endpoint]);

  return { ...state, refetch: fetch };
}

export const dashboardApi = {
  getStats: () => api.get<any>('/analytics'),
  getOrders: () => api.get<any[]>('/orders'),
  getProducts: () => api.get<any[]>('/products'),
  getUsers: () => api.get<any[]>('/users?role=CUSTOMER'),
  getSubscriptions: () => api.get<any[]>('/subscriptions'),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
};

export function useDashboardStats() {
  return useFetch<any>('/analytics');
}

export function useDashboardOrders() {
  return useFetch<any[]>('/orders');
}

export function useDashboardProducts() {
  return useFetch<any[]>('/products');
}

export function useDashboardUsers() {
  return useFetch<any[]>('/users?role=CUSTOMER');
}

export function useDashboardSubscriptions() {
  return useFetch<any[]>('/subscriptions');
}

export const adminApi = {
  getPromos: () => api.get<any[]>('/promo'),
  createPromo: (data: any) => api.post('/promo', data),
  togglePromo: (id: string) => api.patch(`/promo/${id}/toggle`, {}),
};

export function useAdminPromos() {
  return useFetch<any[]>('/promo');
}
