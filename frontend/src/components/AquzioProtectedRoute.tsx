import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AccessDenied from '../pages/AccessDenied';

/**
 * Route protection specifically for Aquzio Biodrops Integration.
 *
 * Rules:
 * 1. Accessible ONLY to: Upper Admin, Admin, Staff.
 * 2. Unauthenticated users -> Redirect to login.
 * 3. Other roles (Customer, Delivery Partner, Distributor, Manager, etc.) -> Render Access Denied page.
 */
export const AquzioProtectedRoute: React.FC = () => {
  const { user, token, authStatus, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <LoadingSpinner size="lg" label="Verifying integration authorization..." />
      </div>
    );
  }

  const actualToken = token || localStorage.getItem('edrops_token');
  const storedUserStr = localStorage.getItem('edrops_user');
  const actualUser =
    user || (storedUserStr ? JSON.parse(storedUserStr) : null);

  // Unauthenticated: redirect to login
  if (authStatus === 'unauthenticated' || !actualToken || !actualUser) {
    const target = encodeURIComponent(location.pathname + location.search);
    return (
      <Navigate
        to={`/login?redirect=${target}&reason=auth_required`}
        state={{ from: location }}
        replace
      />
    );
  }

  const normalizedRole = String(actualUser.role || '')
    .toUpperCase()
    .trim()
    .replace(/[\s\-]/g, '_');

  const isPermitted =
    normalizedRole === 'UPPER_ADMIN' ||
    normalizedRole === 'SUPER_ADMIN' ||
    normalizedRole === 'ADMIN' ||
    normalizedRole === 'STAFF';

  if (!isPermitted) {
    return <AccessDenied />;
  }

  return <Outlet />;
};

export default AquzioProtectedRoute;

