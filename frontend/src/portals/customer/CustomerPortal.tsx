import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Bell, CalendarDays, Droplets, History, Home, Plus, Truck, Package, User, LogOut, ChevronDown, Menu, ShoppingBag, Gift, LifeBuoy } from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

const Shop = React.lazy(() => import('./pages/Shop'));
const Cart = React.lazy(() => import('./pages/Cart'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const WalletPage = React.lazy(() => import('./pages/Wallet'));
const SchedulePlanner = React.lazy(() => import('./pages/SchedulePlanner'));
const TrackPage = React.lazy(() => import('./pages/Track'));
const RechargePage = React.lazy(() => import('./pages/Recharge'));
const ReferPage = React.lazy(() => import('./pages/Refer'));
const SupportPage = React.lazy(() => import('./pages/Support'));
const Profile = React.lazy(() => import('../../pages/Profile'));
const Orders = React.lazy(() => import('./pages/Orders'));
const OrderSuccess = React.lazy(() => import('./pages/OrderSuccess'));

// Desktop specific groupings
const centerNavItems = [
  { to: '/customer/shop', label: 'Shop' },
  { to: '/customer/orders', label: 'Orders' },
  { to: '/customer/schedule', label: 'Schedule' },
  { to: '/customer/deliveries', label: 'Track' },
  { to: '/customer/dashboard', label: 'Dashboard' },
];

const secondaryActions = [
  { to: '/customer/recharge', label: 'Recharge', icon: Plus },
  { to: '/customer/wallet', label: 'Wallet', icon: History },
];

// Mobile specific groupings
const mobileBottomNavItems = [
  { to: '/customer/shop', label: 'Shop', icon: Home },
  { to: '/customer/orders', label: 'Orders', icon: Package },
  { to: '/customer/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/customer/deliveries', label: 'Track', icon: Truck },
  { to: '/customer/profile', label: 'Profile', icon: User },
];

const mobileMoreNavItems = [
  { to: '/customer/dashboard', label: 'Dashboard', icon: Home },
  { to: '/customer/recharge', label: 'Recharge', icon: Plus },
  { to: '/customer/wallet', label: 'Wallet', icon: History },
  { to: '/customer/referrals', label: 'Refer', icon: Gift },
  { to: '/customer/support', label: 'Support', icon: LifeBuoy },
];

function CustomerLoader() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#BBDFF2] border-t-[#2D79A8]"></div>
        <p className="text-sm font-medium text-[#245361]">Loading...</p>
      </div>
    </div>
  );
}

export default function CustomerPortal() {
  const { logout } = useAuth();
  const { totalItems } = useCart();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchWithAuth('/order')
      .then((orders: any[]) => {
        if (Array.isArray(orders)) {
          const count = orders.filter(o => ['PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
          setActiveOrdersCount(count);
        }
      })
      .catch(() => {});
      
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative min-h-screen pb-24 lg:pb-0 bg-[#F8FAFC] text-[#245361]">
      {/* Desktop Enterprise Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-[#E2E8F0] bg-white shadow-sm">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo */}
          <NavLink to="/customer/shop" className="flex items-center gap-3 mr-8 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D79A8] text-white">
              <Droplets className="h-5 w-5" />
            </span>
            <span className="block text-xl font-bold tracking-tight text-[#2D79A8]">Edrops</span>
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
                {item.to === '/customer/orders' && activeOrdersCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-sm border-2 border-white">
                    {activeOrdersCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            
            {/* Secondary Actions (Hidden on smaller screens) */}
            <div className="hidden lg:flex items-center gap-2 mr-2 border-r border-[#E2E8F0] pr-4">
              {secondaryActions.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive ? 'text-[#2D79A8] bg-[#EBF5FB]' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#2D79A8]'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>

            {/* Cart & Notifications */}
            <div className="flex items-center gap-1.5">
              <NavLink
                to="/customer/cart"
                className={({ isActive }) =>
                  `relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-[#EBF5FB] text-[#2D79A8]' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#2D79A8]'
                  }`
                }
              >
                <ShoppingBag className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute 0 top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-sm border border-white">
                    {totalItems}
                  </span>
                )}
              </NavLink>
              
              <button className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#2D79A8] hidden lg:flex">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-[#EF4444] border border-white"></span>
              </button>
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
                    <p className="text-sm font-semibold text-[#0F172A]">My Account</p>
                    <p className="text-xs text-[#64748B] truncate">Manage your settings</p>
                  </div>
                  <NavLink to="/customer/profile" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#475569] hover:bg-[#F8FAFC] hover:text-[#2D79A8] transition-colors">
                    <User className="h-4 w-4" /> Profile
                  </NavLink>
                  <NavLink to="/customer/support" onClick={() => setProfileDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#475569] hover:bg-[#F8FAFC] hover:text-[#2D79A8] transition-colors">
                    <LifeBuoy className="h-4 w-4" /> Support
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

      <main className="relative z-10">
        <Suspense fallback={<CustomerLoader />}>
          <Routes>
            <Route path="shop" element={<Shop />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="schedule" element={<SchedulePlanner />} />
            <Route path="deliveries" element={<TrackPage />} />
            <Route path="orders" element={<Orders />} />
            <Route path="order-success" element={<OrderSuccess />} />
            <Route path="recharge" element={<RechargePage />} />
            <Route path="referrals" element={<ReferPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="" element={<Navigate to="shop" replace />} />
            <Route path="*" element={<Navigate to="shop" replace />} />
          </Routes>
        </Suspense>
      </main>

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
                    {item.to === '/customer/orders' && activeOrdersCount > 0 && (
                      <span className="absolute top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white shadow-sm border border-white">
                        {activeOrdersCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
          
          {/* More Menu Toggle */}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors cursor-pointer ${
              moreMenuOpen ? 'text-[#2D79A8]' : 'text-[#64748B]'
            }`}
          >
            <div className={`flex items-center justify-center p-1.5 rounded-full transition-all ${moreMenuOpen ? 'bg-[#EBF5FB]' : 'bg-transparent'}`}>
              <Menu className={`h-5 w-5`} />
            </div>
            <span className={`text-[10px] font-medium ${moreMenuOpen ? 'font-semibold' : ''}`}>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
