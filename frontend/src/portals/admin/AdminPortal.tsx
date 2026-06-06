import React, { Suspense, useState } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Droplets, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const CatalogManager = React.lazy(() => import('./pages/CatalogManager'));
const OperationsManager = React.lazy(() => import('./pages/OperationsManager'));
const OrdersDashboard = React.lazy(() => import('./pages/OrdersDashboard'));
const FinanceLedger = React.lazy(() => import('./pages/FinanceLedger'));
const CustomersList = React.lazy(() => import('./pages/CustomersList'));
const BusinessSettings = React.lazy(() => import('./pages/BusinessSettings'));
const ReportsCenter = React.lazy(() => import('./pages/ReportsCenter'));
const Profile = React.lazy(() => import('../../pages/Profile'));

const AdminLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
      <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
    </div>
  </div>
);

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/catalog', label: 'Catalog' },
  { to: '/admin/operations', label: 'Operations' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/finance', label: 'Finance' },
];

export default function AdminPortal() {
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen text-foreground animate-fade-in pb-12">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-[24rem] w-[24rem] rounded-full bg-secondary/15 blur-3xl" />
      </div>

      <header className="sticky mt-4 mx-4 rounded-full top-0 z-30 border border-border bg-background/80 backdrop-blur-2xl shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <NavLink to="/admin/dashboard" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Droplets className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">Edrops Admin</span>
            </span>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-2 rounded-full bg-background p-1.5 lg:flex border border-border">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black transition ${
                    isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-secondary/35'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <button 
              onClick={logout}
              className="flex items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-xs font-black uppercase text-white shadow-lg hover:bg-rose-700 cursor-pointer transition active:scale-95"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex lg:hidden p-2 rounded-xl border border-border bg-background/50 hover:bg-secondary/20 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu Slide Down Drawer */}
        {mobileMenuOpen && (
          <div className="absolute top-24 left-0 right-0 z-40 mx-4 border border-border bg-background/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 lg:hidden animate-slide-in">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                onClick={() => setMobileMenuOpen(false)}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black transition ${
                    isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-secondary/20'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <hr className="border-border/60 my-1" />
            <button
              onClick={() => { setMobileMenuOpen(false); logout(); }}
              className="w-full text-center py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black uppercase text-white shadow-md transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<AdminLoader />}>
          <Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="catalog/*" element={<CatalogManager />} />
            <Route path="operations/*" element={<OperationsManager />} />
            <Route path="orders/*" element={<OrdersDashboard />} />
            <Route path="finance/*" element={<FinanceLedger />} />
            <Route path="customers/*" element={<CustomersList />} />
            <Route path="settings" element={<BusinessSettings />} />
            <Route path="reports" element={<ReportsCenter />} />
            <Route path="profile" element={<Profile />} />
            <Route path="" element={<Navigate to="dashboard" replace />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </section>
    </div>
  );
}
