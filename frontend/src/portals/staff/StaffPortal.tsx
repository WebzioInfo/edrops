import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Package, CheckCircle2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SharedSidebar, SharedMobileDrawer } from '../../components/common/SharedSidebar';
import { getPortalSidebarConfig } from '../../components/common/sidebarConfig';

const OrderManagement = React.lazy(() => import('./pages/OrderManagement'));
const RouteOperations = React.lazy(() => import('./pages/RouteOperations'));
const CustomerManagement = React.lazy(() => import('./pages/CustomerManagement'));
const PackageManagement = React.lazy(() => import('./pages/PackageManagement'));
const InventoryAudit = React.lazy(() => import('./pages/InventoryAudit'));
const SupportManagement = React.lazy(() => import('./pages/SupportManagement'));
const Profile = React.lazy(() => import('../../pages/Profile'));
const CustomerForm = React.lazy(() => import('../../pages/CustomerManagement/CustomerForm'));

const StaffLoader = () => (
  <LoadingSpinner fullPage label="Loading portal..." />
);

export default function StaffPortal() {
  const { user } = useAuth();
  const location = useLocation();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isDropdownOpen, setIsDropdownOpen } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const portalConfig = getPortalSidebarConfig(user?.role || 'STAFF');

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/operations')) return 'Route Operations';
    if (path.includes('/orders')) return 'Order Management';
    if (path.includes('/customers')) return 'Customer Management';
    if (path.includes('/packages')) return 'Package Management';
    if (path.includes('/inventory')) return 'Inventory Audit';
    if (path.includes('/support')) return 'Support Management';
    if (path.includes('/profile')) return 'Staff Profile';
    return 'Staff Operations';
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#16324F] font-sans antialiased overflow-hidden">
      {/* ─── STANDARDIZED SHARED DESKTOP SIDEBAR ────────────────── */}
      <SharedSidebar
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
      />

      {/* ─── STANDARDIZED SHARED MOBILE DRAWER ──────────────────── */}
      <SharedMobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
      />

      {/* ─── MAIN CONTENT WRAPPER ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header (h-16) matching Delivery Partner & standard layout */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#64748B] hover:text-[#16324F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-base font-bold text-[#16324F] leading-tight">
                {getPageTitle()}
              </h1>
              <p className="text-[11px] text-[#64748B]">Staff Operations Workspace</p>
            </div>
          </div>

          {/* Right Actions: Notifications */}
          <div className="flex items-center gap-4">
            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1677C8] cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#E2E8F0] bg-white shadow-lg overflow-hidden z-50 flex flex-col max-h-[400px]">
                  <div className="px-4 py-3 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                    <h3 className="text-sm font-semibold text-[#0F172A]">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-[#1677C8] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#64748B]">No notifications</div>
                    ) : (
                      <div className="divide-y divide-[#E2E8F0]">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-4 hover:bg-[#F8FAFC] transition-colors flex gap-3 ${
                              !n.isRead ? 'bg-sky-50/50' : ''
                            }`}
                          >
                            <div className="mt-1">
                              <div className="h-8 w-8 rounded-full bg-sky-50 text-[#1677C8] flex items-center justify-center">
                                <Package className="h-4 w-4" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#0F172A]">{n.title}</p>
                              <p className="text-xs text-[#475569] mt-0.5">{n.message}</p>
                              <p className="text-[10px] text-[#94A3B8] mt-1">
                                {new Date(n.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            {!n.isRead && (
                              <button
                                onClick={() => markAsRead(n.id)}
                                className="text-[#1677C8] hover:bg-sky-100 p-1 rounded-full h-fit cursor-pointer"
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto">
          <section className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Suspense fallback={<StaffLoader />}>
              <Routes>
                <Route path="orders" element={<OrderManagement />} />
                <Route path="operations" element={<RouteOperations />} />
                <Route path="customers/add" element={<CustomerForm basePath="/staff/customers" />} />
                <Route path="customers/*" element={<CustomerManagement />} />
                <Route path="packages" element={<PackageManagement />} />
                <Route path="inventory" element={<InventoryAudit />} />
                <Route path="support" element={<SupportManagement />} />
                <Route path="profile" element={<Profile />} />
                <Route path="" element={<Navigate to="operations" replace />} />
                <Route path="*" element={<Navigate to="operations" replace />} />
              </Routes>
            </Suspense>
          </section>
        </main>
      </div>
    </div>
  );
}
