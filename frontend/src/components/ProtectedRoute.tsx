import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type ProtectedRouteProps = {
  allowedRoles?: Array<'CUSTOMER' | 'STAFF' | 'ADMIN' | 'DELIVERY_PARTNER'>;
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <LoadingSpinner size="lg" label="Verifying session..." />
      </div>
    );
  }

  // Fallback to localStorage to prevent race conditions during fast SPA navigations
  const actualToken = token || localStorage.getItem('edrops_token');
  const actualUser = user || (localStorage.getItem('edrops_user') ? JSON.parse(localStorage.getItem('edrops_user') as string) : null);

  if (!actualToken || !actualUser) {
    const target = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${target}&reason=auth_required`} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(actualUser.role)) {
    // Role not allowed
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
