import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { Suspense, useState } from 'react';
import LoadingSpinner from './components/LoadingSpinner';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import SplashScreen from './components/pwa/SplashScreen';
import { DialogProvider } from './contexts/DialogContext';

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
    <LoadingSpinner size="lg" label="Loading application..." />
  </div>
);

import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('edrops_splash_shown');
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('edrops_splash_shown', 'true');
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DialogProvider>
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/customer/*" element={
              <CartProvider>
                <CustomerPortal />
              </CartProvider>
            } />

            <Route element={<ProtectedRoute allowedRoles={['STAFF']} />}>
              <Route path="/staff/*" element={
                <SocketProvider>
                  <NotificationProvider>
                    <StaffPortal />
                  </NotificationProvider>
                </SocketProvider>
              } />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['DELIVERY_PARTNER']} />}>
              <Route path="/delivery-partner/*" element={<DeliveryPartnerPortal />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/*" element={<AdminPortal />} />
            </Route>

            <Route path="/unauthorized" element={<div className="flex h-screen items-center justify-center font-black text-2xl">Unauthorized Access</div>} />
            <Route path="/" element={<Navigate to="/customer/shop" replace />} />
          </Routes>
        </Suspense>
        <PWAInstallPrompt />
          </BrowserRouter>
        </DialogProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

