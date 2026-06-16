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

  if (!token || !user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Role not allowed
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
