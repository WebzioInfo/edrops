import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  LogOut, 
  LayoutDashboard, 
  Package, 
  Truck, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Settings, 
  FileText, 
  Tag,
  LifeBuoy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { EdropsLogo } from '../../components/Logo';
import MobileSidebarDrawer from '../../components/common/MobileSidebarDrawer';

const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const CatalogManager = React.lazy(() => import('./pages/CatalogManager'));
const OperationsManager = React.lazy(() => import('./pages/OperationsManager'));
const OrdersDashboard = React.lazy(() => import('./pages/OrdersDashboard'));
const FinanceLedger = React.lazy(() => import('./pages/FinanceLedger'));
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

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/catalog', label: 'Catalog', icon: Package },
      { to: '/admin/operations', label: 'Operations', icon: Truck },
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { to: '/admin/finance', label: 'Finance', icon: DollarSign },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/delivery-partners', label: 'Delivery Partners', icon: Truck },
      { to: '/admin/users', label: 'Users & Staff', icon: Users },
      { to: '/admin/promos', label: 'Promo Codes', icon: Tag },
      { to: '/admin/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { to: '/admin/support', label: 'Support', icon: LifeBuoy },
    ],
  },
];

const AdminLoader = () => (
  <div className="flex h-96 items-center justify-center">
    <LoadingSpinner fullPage label="Loading page..." />
  </div>
);

export default function AdminPortal() {
  const { user, logout } = useAuth();
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

  const adminName = user ? `${user.firstName} ${user.lastName}`.trim() || 'Admin User' : 'Administrator';
  const adminInitials = user ? `${user.firstName?.[0] || 'A'}${user.lastName?.[0] || 'D'}`.toUpperCase() : 'AD';

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] text-[#16324F] font-sans antialiased overflow-hidden select-none-headers">
      
      {/* ─── DESKTOP SIDEBAR ────────────────────────────────────── */}
      <aside 
        className={`hidden lg:flex flex-col bg-white border-r border-[#E2E8F0] shrink-0 z-30 transition-all duration-200 ease-in-out select-none ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand Header */}
        <div className={`flex items-center h-14 border-b border-[#E2E8F0] ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <NavLink to="/admin/dashboard" className="flex items-center min-w-0" title="Edrops Admin">
            {collapsed ? (
              <EdropsLogo variant="icon" color="blue" className="h-6 w-6 shrink-0" />
            ) : (
              <div className="flex flex-col justify-center">
                <EdropsLogo variant="blue" className="h-5 w-auto" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#00AEEF] mt-0.5">
                  Admin Panel
                </span>
              </div>
            )}
          </NavLink>

          {/* Collapse Toggle Button */}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1 text-gray-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Trigger */}
        {collapsed && (
          <div className="flex justify-center py-1.5 border-b border-[#E2E8F0] bg-slate-50/50">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1 text-gray-400 hover:text-[#1677C8] hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Item Sections */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 text-[9px] font-bold tracking-wider text-[#94A3B8] uppercase mb-1">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => `
                      group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150
                      ${collapsed ? 'justify-center px-0 h-9 w-9 mx-auto' : ''}
                      ${
                        isActive
                          ? 'bg-[#1677C8]/10 text-[#1677C8] font-bold shadow-2xs'
                          : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'
                      }
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#1677C8]' : 'text-[#64748B] group-hover:text-[#16324F]'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}

                        {/* Collapsed Tooltip Floating label */}
                        {collapsed && (
                          <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                            {item.label}
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer / Account Actions */}
        <div className="p-2.5 border-t border-[#E2E8F0] bg-slate-50/70">
          {/* Settings NavLink */}
          <NavLink
            to="/admin/settings"
            title={collapsed ? 'Settings' : undefined}
            className={({ isActive }) => `
              group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors mb-1.5
              ${collapsed ? 'justify-center px-0 h-8 w-8 mx-auto' : ''}
              ${isActive ? 'bg-[#1677C8]/10 text-[#1677C8]' : 'text-[#64748B] hover:text-[#16324F] hover:bg-white'}
            `}
          >
            <Settings className="w-4 h-4 shrink-0 text-[#64748B] group-hover:text-[#16324F]" />
            {!collapsed && <span className="truncate">Settings</span>}
            {collapsed && (
              <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                Settings
              </div>
            )}
          </NavLink>

          {/* Admin Identity Card */}
          <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between">
            <NavLink
              to="/admin/profile"
              className={`flex items-center gap-2 min-w-0 flex-1 hover:opacity-85 transition group ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? adminName : 'View Profile'}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs group-hover:bg-[#1677C8]/20 transition-colors">
                {adminInitials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#16324F] truncate group-hover:text-[#1677C8] transition-colors leading-tight">
                    {adminName}
                  </p>
                  <p className="text-[9px] font-semibold text-[#64748B] truncate">
                    Administrator
                  </p>
                </div>
              )}
            </NavLink>

            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                title="Logout"
                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── MOBILE DRAWER (SLIDE-OVER FOR SMALL SCREENS) ────────── */}
      <MobileSidebarDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        className="w-72 max-w-[85vw] bg-white"
        ariaLabel="Admin navigation drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-[#E2E8F0]">
          <div className="flex flex-col justify-center">
            <EdropsLogo variant="blue" className="h-6 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AEEF] mt-0.5">
              Admin Panel
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Nav Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase mb-1.5">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors
                      ${
                        isActive
                          ? 'bg-[#1677C8]/10 text-[#1677C8] font-bold'
                          : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'
                      }
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#1677C8]' : 'text-[#64748B]'}`} />
                        <span className="flex-1">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          <div className="pt-2 border-t border-gray-100">
            <NavLink
              to="/admin/settings"
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors
                ${isActive ? 'bg-[#1677C8]/10 text-[#1677C8]' : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'}
              `}
            >
              <Settings className="w-4 h-4 text-[#64748B]" />
              <span>Settings</span>
            </NavLink>
          </div>
        </nav>

        {/* Mobile Drawer Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-slate-50">
          <div className="flex items-center justify-between">
            <NavLink
              to="/admin/profile"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center gap-2.5 min-w-0 flex-1"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs">
                {adminInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#16324F] truncate">{adminName}</p>
                <p className="text-[10px] text-[#64748B]">Administrator</p>
              </div>
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </MobileSidebarDrawer>

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
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs"
            title="Profile"
          >
            {adminInitials}
          </NavLink>
        </header>

        {/* Scrollable Page Content Area */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-4 lg:p-5 bg-[#F8F9FA]">
          <div className="w-full max-w-[1600px] mx-auto">
            <Suspense fallback={<AdminLoader />}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="catalog/*" element={<CatalogManager />} />
                <Route path="operations/*" element={<OperationsManager />} />
                <Route path="orders/new" element={<CreateOrderPOS />} />
                <Route path="orders/management" element={<OrderManagement />} />
                <Route path="orders/*" element={<OrdersDashboard />} />
                <Route path="finance/*" element={<FinanceLedger />} />
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
