import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export interface RequireAuthOptions {
  redirect?: string;
  reason?: 'purchase' | 'cart' | 'checkout' | 'account' | string;
}

export function useRequireAuth() {
  const { user, token, authStatus, isLoading, isAuthenticated: authIsAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = useCallback(
    (action: () => void, options?: RequireAuthOptions) => {
      if (isLoading || authStatus === 'loading') {
        return;
      }

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
    [user, token, authStatus, isLoading, navigate, location]
  );

  const isAuthenticated = authIsAuthenticated || Boolean((token || localStorage.getItem('edrops_token')) && (user || localStorage.getItem('edrops_user')));

  return { requireAuth, isAuthenticated };
}

export default useRequireAuth;
