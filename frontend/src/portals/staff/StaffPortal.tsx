import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Droplets, Menu, Bell, User, LogOut, ChevronDown, Truck, Users, Package, ClipboardList } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Check, CheckCircle2, ShoppingCart } from 'lucide-react';

const OrderManagement = React.lazy(() => import('./pages/OrderManagement'));
const RouteOperations = React.lazy(() => import('./pages/RouteOperations'));
const CustomerManagement = React.lazy(() => import('./pages/CustomerManagement'));
const PackageManagement = React.lazy(() => import('./pages/PackageManagement'));
const InventoryAudit = React.lazy(() => import('./pages/InventoryAudit'));
const SupportManagement = React.lazy(() => import('./pages/SupportManagement'));
const Profile = React.lazy(() => import('../../pages/Profile'));

const centerNavItems = [
  { to: '/staff/orders', label: 'Orders' },
  { to: '/staff/operations', label: 'Operations' },
  { to: '/staff/customers', label: 'Customers' },
  { to: '/staff/packages', label: 'Packages' },
  { to: '/staff/inventory', label: 'Inventory' },
  { to: '/staff/support', label: 'Support' },
];

const mobileBottomNavItems = [
  { to: '/staff/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/staff/operations', label: 'Routes', icon: Truck },
  { to: '/staff/customers', label: 'Customers', icon: Users },
  { to: '/staff/packages', label: 'Packages', icon: Package },
  { to: '/staff/inventory', label: 'Inventory', icon: ClipboardList },
];

const mobileMoreNavItems = [
  { to: '/staff/support', label: 'Support', icon: Menu },
  { to: '/staff/profile', label: 'Profile', icon: User },
];

const StaffLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#BBDFF2] border-t-[#2D79A8]"></div>
      <p className="text-sm font-medium text-[#245361]">Loading...</p>
    </div>
  </div>
);

export default function StaffPortal() {
  const { logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isDropdownOpen, setIsDropdownOpen } = useNotifications();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] text-[#245361] pb-24 lg:pb-0">
      
      {/* Desktop Enterprise Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-[#E2E8F0] bg-white shadow-sm">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo */}
          <NavLink to="/staff/operations" className="flex items-center gap-3 mr-8 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D79A8] text-white">
              <Droplets className="h-5 w-5" />
            </span>
            <span className="block text-xl font-bold tracking-tight text-[#2D79A8]">Edrops Staff</span>
          </NavLink>

          {/* Center Navigation */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {centerNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-[#EBF5FB] text-[#2D79A8]' 
                      : 'text-[#64748B] hover:text-[#2D79A8] hover:bg-[#F8FAFC]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-4">

            {/* Notifications */}
            <div className="relative hidden lg:block">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#2D79A8]"
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
                      <button onClick={markAllAsRead} className="text-xs text-[#2D79A8] hover:underline font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[#64748B]">No notifications</div>
                    ) : (
                      <div className="divide-y divide-[#E2E8F0]">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-4 hover:bg-[#F8FAFC] transition-colors flex gap-3 ${!n.isRead ? 'bg-[#EBF5FB]/30' : ''}`}>
                            <div className="mt-1">
                              <div className="h-8 w-8 rounded-full bg-[#EBF5FB] text-[#2D79A8] flex items-center justify-center">
                                <Package className="h-4 w-4" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#0F172A]">{n.title}</p>
                              <p className="text-xs text-[#475569] mt-0.5">{n.message}</p>
                              <p className="text-[10px] text-[#94A3B8] mt-1">{new Date(n.createdAt).toLocaleTimeString()}</p>
                            </div>
                            {!n.isRead && (
                              <button onClick={() => markAsRead(n.id)} className="text-[#2D79A8] hover:bg-[#EBF5FB] p-1 rounded-full h-fit" title="Mark as read">
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

            {/* Profile Dropdown */}
            <div className="hidden lg:block relative" ref={profileRef}>
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EBF5FB] text-[#2D79A8]">
                  <User className="h-4 w-4" />
                </div>
                <ChevronDown className="h-4 w-4 text-[#64748B] mr-1" />
              </button>
              
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E2E8F0] bg-white shadow-lg overflow-hidden py-1 z-50">
                  <div className="px-4 py-3 border-b border-[#E2E8F0]">
                    <p className="text-sm font-semibold text-[#0F172A]">Delivery Staff</p>
                    <p className="text-xs text-[#64748B] truncate">Active Route</p>
                  </div>
                  <NavLink to="/staff/profile" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#475569] hover:bg-[#F8FAFC] hover:text-[#2D79A8] transition-colors">
                    <User className="h-4 w-4" /> Profile
                  </NavLink>
                  <div className="border-t border-[#E2E8F0] my-1"></div>
                  <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors text-left cursor-pointer">
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 relative z-10">
        <Suspense fallback={<StaffLoader />}>
          <Routes>
            <Route path="orders" element={<OrderManagement />} />
            <Route path="operations" element={<RouteOperations />} />
            <Route path="customers" element={<CustomerManagement />} />
            <Route path="packages" element={<PackageManagement />} />
            <Route path="inventory" element={<InventoryAudit />} />
            <Route path="support" element={<SupportManagement />} />
            <Route path="profile" element={<Profile />} />
            <Route path="" element={<Navigate to="operations" replace />} />
            <Route path="*" element={<Navigate to="operations" replace />} />
          </Routes>
        </Suspense>
      </section>

      {/* Mobile Bottom Sheet for More Menu */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setMoreMenuOpen(false)}>
          <div 
            className="absolute bottom-20 inset-x-3 bg-white border border-[#E2E8F0] rounded-[24px] p-5 shadow-2xl space-y-4 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Additional Options</h4>
              <button onClick={() => setMoreMenuOpen(false)} className="text-[#64748B] hover:bg-[#F1F5F9] p-1 rounded-full cursor-pointer"><ChevronDown className="h-5 w-5" /></button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {mobileMoreNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-colors ${
                        isActive ? 'bg-[#EBF5FB] border-[#2D79A8] text-[#2D79A8]' : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
            <div className="border-t border-[#E2E8F0] pt-4">
              <button
                onClick={() => { setMoreMenuOpen(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#FEF2F2] hover:text-[#EF4444] text-[#475569] text-sm font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2E8F0] bg-white pb-safe lg:hidden">
        <div className="flex h-[68px] items-center justify-around px-2">
          {mobileBottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${
                    isActive ? 'text-[#2D79A8]' : 'text-[#64748B]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center justify-center p-1.5 rounded-full transition-all ${isActive ? 'bg-[#EBF5FB]' : 'bg-transparent'}`}>
                      <Icon className={`h-5 w-5 ${isActive ? 'fill-[#2D79A8]/20' : ''}`} />
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          
          {/* More Menu Toggle */}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`relative flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors cursor-pointer ${
              moreMenuOpen ? 'text-[#2D79A8]' : 'text-[#64748B]'
            }`}
          >
            <div className={`flex items-center justify-center p-1.5 rounded-full transition-all ${moreMenuOpen ? 'bg-[#EBF5FB]' : 'bg-transparent'}`}>
              <Menu className={`h-5 w-5`} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-4 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-white border border-white"></span>
              )}
            </div>
            <span className={`text-[10px] font-medium ${moreMenuOpen ? 'font-semibold' : ''}`}>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
