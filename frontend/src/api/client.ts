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

  const response = await fetch(`${BASE_URL}${endpoint}`, {
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
    } else if (response.status === 401) {
      message = 'Your session has expired. Please sign in again.';
    } else if (response.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (response.status === 404) {
      message = 'The requested resource was not found. Please try again.';
    } else if (response.status >= 500) {
      message = 'Something went wrong on the server. Please try again.';
    } else {
      message = `Request failed with status ${response.status}`;
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
      toast.error('You do not have permission to perform this action.');
    } else if (response.status >= 500) {
      toast.error('Server error. Our team has been notified.');
    }

    throw new Error(message);
  }

  return response.json();
}
