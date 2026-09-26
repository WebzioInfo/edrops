import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { EdropsLogo } from '../../components/Logo';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SharedSidebar, SharedMobileDrawer } from '../../components/common/SharedSidebar';
import { getPortalSidebarConfig } from '../../components/common/sidebarConfig';

const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const CatalogManager = React.lazy(() => import('./pages/CatalogManager'));
const OrdersDashboard = React.lazy(() => import('./pages/OrdersDashboard'));
const CustomersList = React.lazy(() => import('./pages/CustomersList'));
const DeliveryPartnersList = React.lazy(() => import('./pages/DeliveryPartnersList'));
const UsersList = React.lazy(() => import('./pages/UsersList'));
const BusinessSettings = React.lazy(() => import('./pages/BusinessSettings'));
const ReportsCenter = React.lazy(() => import('./pages/ReportsCenter'));
const CustomerDetail = React.lazy(() => import('./pages/CustomerDetail'));
const GlobalSupport = React.lazy(() => import('./pages/GlobalSupport'));
const Profile = React.lazy(() => import('../../pages/Profile'));
const PromoManager = React.lazy(() => import('./pages/PromoManager'));
const CustomerForm = React.lazy(() => import('../../pages/CustomerManagement/CustomerForm'));
const CreateOrderPOS = React.lazy(() => import('./pages/CreateOrderPOS'));
const OrderManagement = React.lazy(() => import('./pages/OrderManagement'));

const AdminLoader = () => (
  <div className="flex h-96 items-center justify-center">
    <LoadingSpinner fullPage label="Loading page..." />
  </div>
);

export default function AdminPortal() {
  const { user } = useAuth();
  const location = useLocation();

  // Sidebar collapse state (persisted)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('edrops_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('edrops_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const adminInitials = user ? `${user.firstName?.[0] || 'A'}${user.lastName?.[0] || 'D'}`.toUpperCase() : 'AD';

  const portalConfig = getPortalSidebarConfig(user?.role || 'ADMIN');

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] text-[#16324F] font-sans antialiased overflow-hidden select-none-headers">
      
      {/* ─── STANDARDIZED SHARED DESKTOP SIDEBAR ────────────────── */}
      <SharedSidebar
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
        collapsible={true}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

      {/* ─── STANDARDIZED SHARED MOBILE DRAWER ──────────────────── */}
      <SharedMobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
      />

      {/* ─── MAIN CONTENT VIEWPORT ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Mobile Top Header (Visible ONLY on mobile/tablet <lg) */}
        <header className="lg:hidden h-14 bg-white border-b border-[#E2E8F0] px-4 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 -ml-1 text-[#64748B] hover:text-[#16324F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <EdropsLogo variant="blue" className="h-5 w-auto" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AEEF] bg-[#00AEEF]/10 px-1.5 py-0.5 rounded">
                Admin
              </span>
            </div>
          </div>

          <NavLink
            to="/admin/profile"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs overflow-hidden"
            title="Profile"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              adminInitials
            )}
          </NavLink>
        </header>

        {/* ─── STANDARDIZED SHARED ADMIN TOPBAR MOUNT ────────────── */}
        <div id="admin-topbar-mount" className="w-full shrink-0 bg-white" />

        {/* Scrollable Page Content Area */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-4 lg:p-5 bg-[#F8F9FA]">
          <div className="w-full max-w-[1600px] mx-auto">
            <Suspense fallback={<AdminLoader />}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="catalog/*" element={<CatalogManager />} />
                <Route path="orders/new" element={<CreateOrderPOS />} />
                <Route path="orders/management" element={<OrderManagement />} />
                <Route path="orders/*" element={<OrdersDashboard />} />
                <Route path="customers/add" element={<CustomerForm basePath="/admin/customers" />} />
                <Route path="customers" element={<CustomersList />} />
                <Route path="customers/:id" element={<CustomerDetail />} />
                <Route path="delivery-partners/*" element={<DeliveryPartnersList />} />
                <Route path="users/*" element={<UsersList />} />
                <Route path="support" element={<GlobalSupport />} />
                <Route path="settings" element={<BusinessSettings />} />
                <Route path="reports" element={<ReportsCenter />} />
                <Route path="profile" element={<Profile />} />
                <Route path="promos" element={<PromoManager />} />
                <Route path="" element={<Navigate to="customers" replace />} />
                <Route path="*" element={<Navigate to="customers" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>

    </div>
  );
}
