import toast from 'react-hot-toast';

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'edrops_token';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = new Headers(options.headers ?? {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Prevent stale conditional caching (304) on API requests
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache');
  }
  if (!headers.has('Pragma')) {
    headers.set('Pragma', 'no-cache');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    cache: options.cache ?? 'no-store',
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (e) {
      // JSON parsing failed
    }

    let message = 'An error occurred. Please try again.';
    if (Array.isArray(errorData?.message)) {
      message = errorData.message.join(', ');
    } else if (typeof errorData?.message === 'string') {
      message = errorData.message;
    } else if (typeof errorData?.error === 'string') {
      message = errorData.error;
    } else if (response.status === 401) {
      message = 'Your session has expired. Please sign in again.';
    } else if (response.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (response.status === 404) {
      message = 'The requested resource was not found. Please try again.';
    } else if (response.status === 409) {
      message = errorData?.message || 'This order has already been accepted by another distributor.';
    } else if (response.status >= 500) {
      message = 'Something went wrong on the server. Please try again.';
    } else {
      message = `Request failed with status ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;
    }

    // Standardized Error Interception
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('edrops_user');
        const currentTarget = window.location.pathname + window.location.search;
        const target = encodeURIComponent(currentTarget);
        window.location.href = `/login?redirect=${target}&reason=session_expired`;
      }
    } else if (response.status === 403) {
      toast.error('You do not have permission to perform this action.', { id: 'auth-forbidden-toast' });
    } else if (response.status >= 500) {
      toast.error('Server error. Our team has been notified.', { id: 'server-error-toast' });
    }

    const error: any = new Error(message);
    error.status = response.status;
    error.statusText = response.statusText;
    error.data = errorData;
    error.handledToast = response.status >= 500 || response.status === 403;
    throw error;
  }

  // Handle empty bodies safely (e.g. 204 No Content or zero content-length)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const text = await response.text();
  if (!text || !text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
