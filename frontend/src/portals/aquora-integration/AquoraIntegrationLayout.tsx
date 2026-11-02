import React, { Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { EdropsLogo } from '../../components/Logo';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SharedSidebar, SharedMobileDrawer } from '../../components/common/SharedSidebar';
import { getPortalSidebarConfig } from '../../components/common/sidebarConfig';

const LayoutLoader = () => (
  <div className="flex h-96 items-center justify-center">
    <LoadingSpinner fullPage label="Loading Aquora Integration..." />
  </div>
);

export const AquoraIntegrationLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('edrops_aquora_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('edrops_aquora_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const userInitials = user
    ? `${user.firstName?.[0] || 'A'}${user.lastName?.[0] || 'D'}`.toUpperCase()
    : 'ED';

  const userRole = user?.role || 'ADMIN';
  const portalConfig = getPortalSidebarConfig(userRole, undefined, user);

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] text-[#16324F] font-sans antialiased overflow-hidden select-none-headers">
      {/* ─── STANDARDIZED DESKTOP SIDEBAR ────────────────── */}
      <SharedSidebar
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
        collapsible={true}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

      {/* ─── STANDARDIZED MOBILE DRAWER ──────────────────── */}
      <SharedMobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
      />

      {/* ─── MAIN CONTENT VIEWPORT ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Top Header (Visible on <lg screens) */}
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Biodrops
              </span>
            </div>
          </div>

          <NavLink
            to={portalConfig.profilePath}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs overflow-hidden"
            title="Profile"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              userInitials
            )}
          </NavLink>
        </header>

        {/* Scrollable Page Content Area */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6 bg-[#F8F9FA]">
          <div className="w-full max-w-[1600px] mx-auto">
            <Suspense fallback={<LayoutLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AquoraIntegrationLayout;

