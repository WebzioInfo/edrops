import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  Menu,
  LogOut,
  LayoutDashboard,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { fetchWithAuth } from '../../api/client';
import { EdropsLogo } from '../../components/Logo';
import { SharedSidebar, SharedMobileDrawer } from '../../components/common/SharedSidebar';
import { getPortalSidebarConfig } from '../../components/common/sidebarConfig';
import LoadingSpinner from '../../components/LoadingSpinner';

const Purchases = React.lazy(() => import('./pages/Purchases'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const SupplierDetail = React.lazy(() => import('./pages/SupplierDetail'));
const Orders = React.lazy(() => import('./pages/Orders'));
const NewOrders = React.lazy(() => import('./pages/NewOrders'));
const Profile = React.lazy(() => import('../../pages/Profile'));



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
  const { logout } = useAuth();
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



  const portalConfig = getPortalSidebarConfig('DISTRIBUTOR', {
    newOrdersCount,
  });

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* ─── STANDARDIZED SHARED DESKTOP SIDEBAR ──────────────────── */}
      <SharedSidebar
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
        collapsible={true}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

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

        {/* ─── STANDARDIZED SHARED MOBILE DRAWER ────────────────── */}
        <SharedMobileDrawer
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          portalLabel={portalConfig.portalLabel}
          sections={portalConfig.sections}
          homePath={portalConfig.homePath}
          profilePath={portalConfig.profilePath}
        />

        {/* ─── FULL-WIDTH OPERATIONAL MAIN CONTENT AREA ──────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F8FAFC]">
          <Suspense fallback={<LoadingSpinner fullPage label="Loading..." />}>
            <Routes>
              <Route index element={<Navigate to="/distributor/purchases" replace />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/:id" element={<SupplierDetail />} />
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
