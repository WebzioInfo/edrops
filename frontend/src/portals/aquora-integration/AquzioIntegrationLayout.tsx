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
    <LoadingSpinner fullPage label="Loading Aquzio Integration..." />
  </div>
);

export const AquzioIntegrationLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('edrops_aquzio_sidebar_collapsed') === 'true' ||
        localStorage.getItem('edrops_aquora_sidebar_collapsed') === 'true'
      );
    } catch {
      return false;
    }
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('edrops_aquzio_sidebar_collapsed', String(next));
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

      {/* ─── MAIN CONTENT AREA ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <EdropsLogo className="h-6 w-auto" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-2 border-l border-slate-200">
                Aquzio
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              to={portalConfig.profilePath}
              className="w-8 h-8 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center justify-center hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 transition-all"
            >
              {userInitials}
            </NavLink>
          </div>
        </header>

        {/* Dynamic Route Body with Suspense fallback */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <Suspense fallback={<LayoutLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AquzioIntegrationLayout;

