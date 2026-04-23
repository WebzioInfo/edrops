import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────
// Axios instance with auth interceptor
// ─────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request from Zustand persisted storage
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.state?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// Global 401 handler — clear auth and redirect to login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const sendOtp = (phone: string) => api.post('/auth/send-otp', { phone });
export const verifyOtp = (phone: string, otp: string, name?: string) =>
  api.post('/auth/verify-otp', { phone, otp, name });
export const getMe = () => api.get('/auth/me');

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────

export const useProducts = (brandId?: string) =>
  useQuery({
    queryKey: ['products', brandId],
    queryFn: () =>
      api.get('/products', { params: brandId ? { brandId } : {} }).then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

export const useBrands = () =>
  useQuery({
    queryKey: ['brands'],
    queryFn: () => api.get('/products/brands').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────

export const useMyOrders = () =>
  useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/my').then((r) => r.data),
  });

export const useOrder = (id: string) =>
  useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const usePlaceOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/orders', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-orders'] }),
  });
};

export const useCancelOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-orders'] }),
  });
};

// ─────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────

export const useMySubscriptions = () =>
  useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/subscriptions/my').then((r) => r.data),
  });

export const useCreateSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/subscriptions', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });
};

export const usePauseSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/pause`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });
};

export const useResumeSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/resume`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });
};

export const useSkipNext = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/subscriptions/${id}/skip-next`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });
};

export const useCancelSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/subscriptions/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subscriptions'] }),
  });
};

// ─────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────

export const useWallet = () =>
  useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/wallet').then((r) => r.data),
  });

export const useWalletTransactions = (page = 1) =>
  useQuery({
    queryKey: ['wallet-transactions', page],
    queryFn: () =>
      api.get('/wallet/transactions', { params: { page, limit: 20 } }).then((r) => r.data),
  });

export const useCreateRechargeOrder = () =>
  useMutation({
    mutationFn: (amount: number) =>
      api.post('/payments/wallet/create-recharge', { amount }).then((r) => r.data),
  });

export const useVerifyWalletRecharge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api.post('/payments/wallet/verify-recharge', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      qc.invalidateQueries({ queryKey: ['my-subscriptions'] });
    },
  });
};

// ─────────────────────────────────────────────
// ADDRESSES
// ─────────────────────────────────────────────

export const useMyAddresses = () =>
  useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/me/addresses').then((r) => r.data),
  });

export const useAddAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/users/me/addresses', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
};

// ─────────────────────────────────────────────
// PAYMENTS (Razorpay order checkout)
// ─────────────────────────────────────────────

export const createRazorpayOrder = (orderId: string) =>
  api.post(`/payments/razorpay/create/${orderId}`).then((r) => r.data);

export const verifyRazorpayPayment = (data: any) =>
  api.post('/payments/razorpay/verify', data).then((r) => r.data);

// ─────────────────────────────────────────────
// PROMO
// ─────────────────────────────────────────────

export const useValidatePromo = () =>
  useMutation({
    mutationFn: (data: { code: string; orderAmount: number }) =>
      api.post('/promo/validate', data).then((r) => r.data),
  });
