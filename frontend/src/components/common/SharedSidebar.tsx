import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, X, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { EdropsLogo } from '../Logo';
import MobileSidebarDrawer from './MobileSidebarDrawer';
import type { SidebarNavSection } from './sidebarConfig';

export interface SharedSidebarProps {
  portalLabel: string;
  sections: SidebarNavSection[];
  homePath?: string;
  profilePath?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export interface SharedMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  portalLabel: string;
  sections: SidebarNavSection[];
  homePath?: string;
  profilePath?: string;
}

/**
 * Shared Desktop Sidebar Component
 * Matches the Delivery Partner reference exactly:
 * - w-64 width (or w-16 when collapsed)
 * - h-16 header with Edrops Logo and uppercase cyan portal label
 * - Clean section headers (11px, tracking-wider, text-[#94A3B8])
 * - 40px height nav rows with 20px icons (w-5 h-5), gap-3, rounded-xl
 * - Active: bg-[#1677C8]/10 text-[#1677C8] font-semibold
 * - Inactive: text-[#64748B] hover:text-[#16324F] hover:bg-slate-50
 * - Fixed footer with user initials avatar, user name, pulsing green "Online" dot, and logout button
 */
export function SharedSidebar({
  portalLabel,
  sections,
  homePath = '/',
  profilePath,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  className = '',
}: SharedSidebarProps) {
  const { user, logout } = useAuth();

  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || portalLabel : portalLabel;
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || portalLabel.substring(0, 2)
    : portalLabel.substring(0, 2);

  const defaultProfileLink = profilePath || `${homePath.replace(/\/$/, '')}/profile`;

  return (
    <aside
      className={`hidden lg:flex flex-col bg-white border-r border-[#E2E8F0] shrink-0 select-none z-30 transition-all duration-200 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      } ${className}`}
    >
      {/* ─── BRAND HEADER (h-16) ─────────────────────────────────── */}
      <div
        className={`h-16 flex items-center border-b border-[#E2E8F0] shrink-0 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-6'
        }`}
      >
        <NavLink to={homePath} className="flex items-center min-w-0" title={`Edrops - ${portalLabel}`}>
          {collapsed ? (
            <EdropsLogo variant="icon" color="blue" className="h-6 w-6 shrink-0 mx-auto" />
          ) : (
            <div className="flex flex-col justify-center min-w-0">
              <EdropsLogo variant="blue" className="h-6 w-auto" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AEEF] mt-0.5 truncate">
                {portalLabel}
              </span>
            </div>
          )}
        </NavLink>

        {collapsible && !collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 text-gray-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapsed Expand Trigger */}
      {collapsible && collapsed && onToggleCollapse && (
        <div className="flex justify-center py-1.5 border-b border-[#E2E8F0] bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 text-gray-400 hover:text-[#1677C8] hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── NAVIGATION SECTIONS LIST ────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <div className="px-3 text-[11px] font-semibold tracking-wider text-[#94A3B8] uppercase mb-2">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const hasBadge = item.badge !== undefined && item.badge !== null && item.badge !== 0;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `
                    group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${collapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : ''}
                    ${
                      isActive
                        ? 'bg-[#1677C8]/10 text-[#1677C8] font-semibold shadow-2xs'
                        : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-colors ${
                          isActive ? 'text-[#1677C8]' : 'text-[#64748B] group-hover:text-[#16324F]'
                        }`}
                      />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && hasBadge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.badgeVariant === 'rose'
                              ? 'bg-rose-500 text-white'
                              : isActive
                              ? 'bg-[#1677C8] text-white'
                              : 'bg-slate-100 text-[#64748B]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ─── FOOTER / USER PROFILE AREA ──────────────────────────── */}
      <div className="p-4 border-t border-[#E2E8F0] bg-slate-50/50 shrink-0">
        {!user ? (
          <NavLink
            to="/login"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </NavLink>
        ) : collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <NavLink
              to={defaultProfileLink}
              title={userName}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs hover:bg-[#1677C8]/20 transition-colors"
            >
              {userInitials}
            </NavLink>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <NavLink
              to={defaultProfileLink}
              className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-85 transition group cursor-pointer"
              title="View & Manage Profile"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs group-hover:bg-[#1677C8]/20 transition-colors">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#16324F] truncate group-hover:text-[#1677C8] transition-colors">
                  {userName}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Online</span>
                </div>
              </div>
            </NavLink>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Shared Mobile Drawer Component
 * Matches the Delivery Partner reference slide-over drawer exactly.
 */
export function SharedMobileDrawer({
  isOpen,
  onClose,
  portalLabel,
  sections,
  homePath = '/',
  profilePath,
}: SharedMobileDrawerProps) {
  const { user, logout } = useAuth();

  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || portalLabel : portalLabel;
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || portalLabel.substring(0, 2)
    : portalLabel.substring(0, 2);

  const defaultProfileLink = profilePath || `${homePath.replace(/\/$/, '')}/profile`;

  return (
    <MobileSidebarDrawer
      isOpen={isOpen}
      onClose={onClose}
      className="w-72 max-w-[85vw] bg-white flex flex-col h-full select-none"
      ariaLabel={`${portalLabel} navigation drawer`}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[#E2E8F0] shrink-0">
        <div className="flex flex-col justify-center min-w-0">
          <EdropsLogo variant="blue" className="h-6 w-auto" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00AEEF] mt-0.5 truncate">
            {portalLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 text-[11px] font-semibold tracking-wider text-[#94A3B8] uppercase mb-2">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const hasBadge = item.badge !== undefined && item.badge !== null && item.badge !== 0;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) => `
                    group flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-[#1677C8]/10 text-[#1677C8] font-semibold'
                        : 'text-[#64748B] hover:text-[#16324F] hover:bg-slate-50'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-[#1677C8]' : 'text-[#64748B]'}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {hasBadge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.badgeVariant === 'rose'
                              ? 'bg-rose-500 text-white'
                              : isActive
                              ? 'bg-[#1677C8] text-white'
                              : 'bg-slate-100 text-[#64748B]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Drawer User Profile Footer */}
      <div className="p-4 border-t border-[#E2E8F0] bg-slate-50/50 shrink-0">
        {!user ? (
          <NavLink
            to="/login"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </NavLink>
        ) : (
          <div className="flex items-center justify-between">
            <NavLink
              to={defaultProfileLink}
              onClick={onClose}
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs group-hover:bg-[#1677C8]/20 transition-colors">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#16324F] truncate group-hover:text-[#1677C8] transition-colors">
                  {userName}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span>Online</span>
                </div>
              </div>
            </NavLink>
            <button
              onClick={() => {
                onClose();
                logout();
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </MobileSidebarDrawer>
  );
}

export default SharedSidebar;
