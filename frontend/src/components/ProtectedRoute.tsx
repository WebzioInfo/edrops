import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type ProtectedRouteProps = {
  allowedRoles?: Array<'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER'>;
};

const ROLE_PATHS: Record<string, string> = {
  CUSTOMER: '/customer/shop',
  STAFF: '/staff',
  ADMIN: '/admin',
  DELIVERY_PARTNER: '/delivery-partner',
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, token, authStatus, isLoading } = useAuth();
  const location = useLocation();

  // 1. While auth state is initializing or hydrating, NEVER make a redirect decision or show auth errors
  if (isLoading || authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <LoadingSpinner size="lg" label="Verifying session..." />
      </div>
    );
  }

  // Fallback to localStorage to prevent race conditions during fast SPA navigations
  const actualToken = token || localStorage.getItem('edrops_token');
  const actualUser = user || (localStorage.getItem('edrops_user') ? JSON.parse(localStorage.getItem('edrops_user') as string) : null);

  const target = encodeURIComponent(location.pathname + location.search);

  // 2. Only redirect to login when confirmed unauthenticated
  if (authStatus === 'unauthenticated' || !actualToken || !actualUser) {
    return <Navigate to={`/login?redirect=${target}&reason=auth_required`} state={{ from: location }} replace />;
  }

  // 3. User is authenticated, but role is not allowed for this route: safely route to their portal
  if (allowedRoles && !allowedRoles.includes(actualUser.role)) {
    const defaultPortal = ROLE_PATHS[actualUser.role] ?? '/customer/shop';
    return <Navigate to={defaultPortal} replace />;
  }

  return <Outlet />;
}
