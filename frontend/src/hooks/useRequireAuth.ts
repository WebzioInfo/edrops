import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export interface RequireAuthOptions {
  redirect?: string;
  reason?: 'purchase' | 'cart' | 'checkout' | 'account' | string;
}

export function useRequireAuth() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = useCallback(
    (action: () => void, options?: RequireAuthOptions) => {
      const storedToken = token || localStorage.getItem('edrops_token');
      const storedUser = user || localStorage.getItem('edrops_user');

      if (storedToken && storedUser) {
        action();
        return;
      }

      const currentPath = location.pathname + location.search;
      const targetRedirect = options?.redirect || currentPath || '/customer/shop';
      const reason = options?.reason || 'purchase';

      const searchParams = new URLSearchParams();
      searchParams.set('redirect', targetRedirect);
      searchParams.set('reason', reason);

      navigate(`/login?${searchParams.toString()}`, {
        state: {
          from: { pathname: targetRedirect },
          redirect: targetRedirect,
          reason,
        },
      });
    },
    [user, token, navigate, location]
  );

  const isAuthenticated = Boolean((token || localStorage.getItem('edrops_token')) && (user || localStorage.getItem('edrops_user')));

  return { requireAuth, isAuthenticated };
}

export default useRequireAuth;
