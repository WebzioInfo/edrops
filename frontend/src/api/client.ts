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
    if (response.status === 401) {
      // Clear stale session and redirect
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('edrops_user');
      window.location.href = '/login';
    }

    const errorData = await response.json().catch(() => null);
    const message =
      Array.isArray(errorData?.message)
        ? errorData.message[0]
        : errorData?.message ?? `Request failed (${response.status})`;

    throw new Error(message);
  }

  return response.json();
}
