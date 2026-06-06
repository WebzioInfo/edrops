import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { Suspense } from 'react';

// Providers
const queryClient = new QueryClient();

// Lazy load portal shells
const CustomerPortal = React.lazy(() => import('./portals/customer/CustomerPortal'));
const StaffPortal = React.lazy(() => import('./portals/staff/StaffPortal'));
const AdminPortal = React.lazy(() => import('./portals/admin/AdminPortal'));
const DeliveryPartnerPortal = React.lazy(() => import('./portals/delivery-partner/DeliveryPartnerPortal'));
const Login = React.lazy(() => import('./pages/auth/Auth'));
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/auth/ResetPassword'));

// Loading Fallback
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="water-shell flex h-28 w-28 items-center justify-center rounded-[2rem]">
      <div className="h-14 w-14 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30" />
    </div>
  </div>
);

import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="/customer/*" element={
                <CartProvider>
                  <CustomerPortal />
                </CartProvider>
              } />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['STAFF']} />}>
              <Route path="/staff/*" element={<StaffPortal />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['DELIVERY_PARTNER']} />}>
              <Route path="/delivery-partner/*" element={<DeliveryPartnerPortal />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/*" element={<AdminPortal />} />
            </Route>

            <Route path="/unauthorized" element={<div className="flex h-screen items-center justify-center font-black text-2xl">Unauthorized Access</div>} />
            <Route path="/" element={<Navigate to="/customer" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
