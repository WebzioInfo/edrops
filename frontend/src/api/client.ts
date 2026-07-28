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

    const message =
      Array.isArray(errorData?.message)
        ? errorData.message[0]
        : errorData?.message ?? `Request failed (${response.status})`;

    // Standardized Error Interception
    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      toast.error('Session expired. Please log in again.');
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('edrops_user');
      window.location.href = '/login';
    } else if (response.status === 403) {
      toast.error('You do not have permission to perform this action.');
    } else if (response.status === 404) {
      // Optional: Ignore generic 404s or log them
    } else if (response.status >= 500) {
      toast.error('Server error. Our team has been notified.');
    }

    throw new Error(message);
  }

  return response.json();
}
