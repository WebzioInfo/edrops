import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import React, { Suspense, useState } from 'react';
import { Bell, CalendarDays, Droplets, History, Home, Plus, Truck } from 'lucide-react';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const WalletPage = React.lazy(() => import('./pages/Wallet'));
const SchedulePlanner = React.lazy(() => import('./pages/SchedulePlanner'));
const TrackPage = React.lazy(() => import('./pages/Track'));
const RechargePage = React.lazy(() => import('./pages/Recharge'));
const ReferPage = React.lazy(() => import('./pages/Refer'));
const SupportPage = React.lazy(() => import('./pages/Support'));
const Profile = React.lazy(() => import('../../pages/Profile'));

const primaryNavItems = [
  { to: '/customer/dashboard', label: 'Home', icon: Home },
  { to: '/customer/wallet', label: 'Wallet', icon: History },
  { to: '/customer/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/customer/deliveries', label: 'Track', icon: Truck },
];

const secondaryNavItems = [
  { to: '/customer/recharge', label: 'Recharge', icon: Plus },
  { to: '/customer/referrals', label: 'Refer', icon: Bell },
  { to: '/customer/support', label: 'Support', icon: Droplets },
];

const allNavItems = [...primaryNavItems, ...secondaryNavItems];

function CustomerLoader() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
        <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
      </div>
    </div>
  );
}

import { useAuth } from '../../contexts/AuthContext';
import { Menu } from 'lucide-react';

export default function CustomerPortal() {
  const { logout } = useAuth();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 text-foreground lg:pb-0">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-[24rem] w-[24rem] rounded-full bg-secondary/30 blur-3xl" />
      </div>

      <header className="sticky mt-4 mx-4 rounded-full top-0 z-30 border-b border-border bg-background/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/customer/dashboard" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Droplets className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">Edrops</span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-2 rounded-full bg-background p-1.5 shadow-sm lg:flex border border-border">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black transition ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-secondary/35'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <NavLink
              to="/customer/profile"
              className={({ isActive }) =>
                `hidden rounded-full px-5 py-3 text-sm font-black shadow-sm transition hover:-translate-y-0.5 sm:inline-flex ${
                  isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-white/80 text-edrops-ocean'
                }`
              }
            >
              Profile
            </NavLink>
            <button
              onClick={logout}
              className="flex items-center justify-center rounded-full bg-edrops-ocean px-4 py-2 text-sm font-black text-white shadow-lg hover:bg-edrops-ocean/80"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <Suspense fallback={<CustomerLoader />}>
          <Routes>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="schedule" element={<SchedulePlanner />} />
            <Route path="deliveries" element={<TrackPage />} />
            <Route path="recharge" element={<RechargePage />} />
            <Route path="referrals" element={<ReferPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="" element={<Navigate to="dashboard" replace />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Mobile Bottom Sheet for More Menu */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden" onClick={() => setMoreMenuOpen(false)}>
          <div 
            className="absolute bottom-20 inset-x-3 bg-background border border-border rounded-[2rem] p-5 shadow-2xl space-y-4 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Additional Options</h4>
            <div className="grid grid-cols-3 gap-3">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-border/40 font-black text-xs transition ${
                        isActive ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary/10 text-muted-foreground hover:bg-secondary/20'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
            <hr className="border-border/50" />
            <div className="grid grid-cols-2 gap-3">
              <NavLink
                to="/customer/profile"
                onClick={() => setMoreMenuOpen(false)}
                className="text-center py-3.5 rounded-2xl border border-border bg-slate-50 text-xs font-black uppercase text-[#245361] transition"
              >
                Profile Settings
              </NavLink>
              <button
                onClick={() => { setMoreMenuOpen(false); logout(); }}
                className="py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black uppercase text-white shadow-sm transition cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile 5-Tab Navigation Bar */}
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.75rem] border border-border bg-background/90 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreMenuOpen(false)}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[0.7rem] font-black transition ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreMenuOpen(!moreMenuOpen)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[0.7rem] font-black transition cursor-pointer ${
            moreMenuOpen ? 'bg-secondary text-primary' : 'text-muted-foreground'
          }`}
        >
          <Menu className="h-4 w-4" />
          More
        </button>
      </nav>
    </div>
  );
}
