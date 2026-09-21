import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import {
  Menu,
  LogOut,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  User,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';
import MobileSidebarDrawer from '../../components/common/MobileSidebarDrawer';
import LoadingSpinner from '../../components/LoadingSpinner';

const Purchases = React.lazy(() => import('./pages/Purchases'));
const Orders = React.lazy(() => import('./pages/Orders'));
const NewOrders = React.lazy(() => import('./pages/NewOrders'));
const Profile = React.lazy(() => import('../../pages/Profile'));

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: '/distributor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/distributor/new-orders', label: 'New Orders', icon: Inbox },
  { to: '/distributor/orders', label: 'Orders', icon: Package },
  { to: '/distributor/purchases', label: 'Purchases', icon: ShoppingCart },
  { to: '/distributor/wallet', label: 'Wallet', icon: Wallet },
  { to: '/distributor/reports', label: 'Reports', icon: BarChart3 },
];

/** Clean full-width operational placeholder for remaining distributor routes */
function OperationalPlaceholder({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="w-full p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#16324F] leading-tight">{title}</h1>
          <p className="text-xs text-[#64748B]">Distributor {title.toLowerCase()} operational view</p>
        </div>
      </div>
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-xs text-[#64748B]">
        <p className="font-semibold text-sm text-[#16324F] mb-1">{title} Module</p>
        <p className="text-slate-500">Navigation is configured. Operational controls for {title.toLowerCase()} will be attached here.</p>
      </div>
    </div>
  );
}

export default function DistributorPortal() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('edrops_distributor_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { socket } = useSocket();
  const [newOrdersCount, setNewOrdersCount] = useState<number>(0);

  // Load initial unassigned orders count once on mount (skip if already on /distributor/new-orders to prevent duplicate calls)
  useEffect(() => {
    let isMounted = true;

    const handleQueueSync = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setNewOrdersCount(customEvent.detail);
      }
    };
    window.addEventListener('edrops:queueCount', handleQueueSync);

    if (location.pathname !== '/distributor/new-orders') {
      fetchWithAuth('/orders/distributor/new-orders?limit=1')
        .then((res) => {
          if (isMounted && typeof res?.stats?.queueCount === 'number') {
            setNewOrdersCount(res.stats.queueCount);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
      window.removeEventListener('edrops:queueCount', handleQueueSync);
    };
  }, [location.pathname]);

  // Listen to WebSocket real-time events to dynamically update badge count (ZERO POLLING)
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = () => {
      setNewOrdersCount((c) => c + 1);
    };

    const handleOrderClaimed = () => {
      setNewOrdersCount((c) => Math.max(0, c - 1));
    };

    socket.on('NEW_ORDER_AVAILABLE', handleNewOrder);
    socket.on('ORDER_CLAIMED', handleOrderClaimed);

    return () => {
      socket.off('NEW_ORDER_AVAILABLE', handleNewOrder);
      socket.off('ORDER_CLAIMED', handleOrderClaimed);
    };
  }, [socket]);

  useEffect(() => {
    try {
      localStorage.setItem('edrops_distributor_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  const distributorName = `${user?.firstName || 'Distributor'} ${user?.lastName || ''}`.trim();
  const distributorInitials = `${user?.firstName?.[0] || 'D'}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* ─── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col border-r border-[#E2E8F0] bg-white transition-all duration-200 ease-in-out select-none z-30 shrink-0 overflow-x-hidden ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {/* Sidebar Header / Brand */}
        <div className={`h-16 flex items-center border-b border-[#E2E8F0] shrink-0 overflow-x-hidden ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}>
          <NavLink
            to="/distributor/dashboard"
            className="flex items-center min-w-0"
            title="Edrops Distributor Portal"
          >
            {collapsed ? (
              <EdropsLogo variant="icon" color="blue" className="h-7 w-7 shrink-0 mx-auto" />
            ) : (
              <div className="flex flex-col min-w-0">
                <EdropsLogo variant="blue" className="h-5 w-auto" />
                <div className="mt-1">
                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-sky-50 text-[#0088CC] border border-sky-200/80">
                    DISTRIBUTOR
                  </span>
                </div>
              </div>
            )}
          </NavLink>

          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 text-gray-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Trigger */}
        {collapsed && (
          <div className="flex justify-center py-1.5 border-b border-[#E2E8F0] bg-slate-50/70 shrink-0">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 text-gray-400 hover:text-[#1677C8] hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isNewOrders = item.to === '/distributor/new-orders';
            const showBadge = isNewOrders && newOrdersCount > 0;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => `
                  group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150
                  ${collapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : ''}
                  ${
                    isActive
                      ? 'bg-[#1677C8]/10 text-[#1677C8] font-bold shadow-2xs'
                      : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-[#1677C8]' : 'text-[#64748B] group-hover:text-[#16324F]'
                        }`}
                      />
                      {collapsed && showBadge && (
                        <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-amber-500 text-white font-black text-[8px] flex items-center justify-center animate-pulse shadow-xs">
                          {newOrdersCount > 99 ? '99+' : newOrdersCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!collapsed && showBadge && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] leading-none shadow-2xs animate-pulse">
                        {newOrdersCount}
                      </span>
                    )}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                        {item.label} {showBadge ? `(${newOrdersCount})` : ''}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer / Profile & Logout */}
        <div className="p-2.5 border-t border-[#E2E8F0] bg-slate-50/70 shrink-0 overflow-x-hidden">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <NavLink
                to="/distributor/profile"
                className="group relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs hover:bg-[#1677C8]/20 transition-colors"
                title="Profile"
              >
                {distributorInitials}
                <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  Profile ({distributorName})
                </div>
              </NavLink>

              <button
                type="button"
                onClick={logout}
                title="Logout"
                className="group relative flex h-8 w-8 items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  Logout
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <NavLink
                to="/distributor/profile"
                className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-85 transition group"
                title="View Profile"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs group-hover:bg-[#1677C8]/20 transition-colors">
                  {distributorInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#16324F] truncate group-hover:text-[#1677C8] transition-colors leading-tight">
                    {distributorName}
                  </p>
                  <p className="text-[9px] font-semibold text-[#64748B] truncate">
                    Distributor
                  </p>
                </div>
              </NavLink>

              <button
                type="button"
                onClick={logout}
                title="Logout"
                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN LAYOUT WRAPPER ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-[#16324F] hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <EdropsLogo variant="blue" className="h-5 w-auto" />
            <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase tracking-wider bg-sky-50 text-[#0088CC] border border-sky-200">
              DISTRIBUTOR
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Logout"
            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Mobile Slide-Over Drawer */}
        <MobileSidebarDrawer
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ariaLabel="Distributor Navigation"
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <EdropsLogo variant="blue" className="h-5 w-auto" />
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-sky-50 text-[#0088CC] border border-sky-200">
                  DISTRIBUTOR
                </span>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isNewOrders = item.to === '/distributor/new-orders';
                const showBadge = isNewOrders && newOrdersCount > 0;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors
                      ${
                        isActive
                          ? 'bg-[#1677C8]/10 text-[#1677C8] font-bold'
                          : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-xs leading-none shadow-2xs animate-pulse">
                        {newOrdersCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/70">
              <NavLink
                to="/distributor/profile"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-white hover:text-[#16324F] transition-colors mb-2"
              >
                <User className="w-4 h-4 shrink-0" />
                <span>Profile</span>
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </MobileSidebarDrawer>

        {/* ─── FULL-WIDTH OPERATIONAL MAIN CONTENT AREA ──────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F8FAFC]">
          <Suspense fallback={<LoadingSpinner fullPage label="Loading..." />}>
            <Routes>
              <Route index element={<Navigate to="/distributor/purchases" replace />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="dashboard" element={<OperationalPlaceholder title="Dashboard" icon={LayoutDashboard} />} />
              <Route path="new-orders" element={<NewOrders />} />
              <Route path="orders" element={<Orders />} />
              <Route path="wallet" element={<OperationalPlaceholder title="Wallet" icon={Wallet} />} />
              <Route path="reports" element={<OperationalPlaceholder title="Reports" icon={BarChart3} />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/distributor/purchases" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
