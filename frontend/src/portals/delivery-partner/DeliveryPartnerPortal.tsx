import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Save,
  Plus,
  Minus,
  RotateCw
} from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SharedSidebar, SharedMobileDrawer } from '../../components/common/SharedSidebar';
import { getPortalSidebarConfig } from '../../components/common/sidebarConfig';
import { useRegisterRefreshHandler } from '../../components/pwa/PullToRefresh';
import { formatOrderId } from '../../utils/orderFormatters';

import Overview from './pages/Overview';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Profits from './pages/Profits';
import Profile from './pages/Profile';
import type { DeliveryTask } from './pages/Overview';



export default function DeliveryPartnerPortal() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Delivery log modal state
  const [activeTask, setActiveTask] = useState<DeliveryTask | null>(null);
  const [deliveredQty, setDeliveredQty] = useState(0);
  const [emptyCollected, setEmptyCollected] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checkOfflineQueueCount = () => {
    try {
      const queue = JSON.parse(localStorage.getItem('offline_delivery_reports') || '[]');
      setOfflineQueueCount(queue.length);
    } catch {
      setOfflineQueueCount(0);
    }
  };

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/delivery/partner/my-tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assigned delivery tasks');
    } finally {
      setLoading(false);
      checkOfflineQueueCount();
    }
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem('offline_delivery_reports') || '[]');
    if (queue.length === 0) {
      setOfflineQueueCount(0);
      return;
    }

    toast.loading('Syncing offline reports...', { id: 'sync-status' });
    let successCount = 0;
    const remainingQueue = [];

    for (const report of queue) {
      try {
        await fetchWithAuth(`/delivery/${report.deliveryId}/report`, {
          method: 'POST',
          body: JSON.stringify({
            deliveredQty: report.deliveredQty,
            emptyCollected: report.emptyCollected,
            notes: report.notes,
          }),
        });
        successCount++;
      } catch {
        remainingQueue.push(report);
      }
    }

    localStorage.setItem('offline_delivery_reports', JSON.stringify(remainingQueue));
    setOfflineQueueCount(remainingQueue.length);
    toast.dismiss('sync-status');
    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline reports!`);
      loadTasks();
    }
  }, [loadTasks]);

  useRegisterRefreshHandler(loadTasks);

  useEffect(() => {
    loadTasks();
    checkOfflineQueueCount();
    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue();
    return () => {
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, [loadTasks, syncOfflineQueue]);

  // Handle ESC key to close mobile drawer and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setActiveTask(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const openReportModal = (task: DeliveryTask) => {
    setActiveTask(task);
    setDeliveredQty(task.requiredQuantity || 1);
    setEmptyCollected(task.requiredQuantity || 0);
    setNotes('');
  };

  const handleReportSubmit = async () => {
    if (!activeTask) return;
    const reportData = {
      deliveryId: activeTask.id,
      deliveredQty,
      emptyCollected,
      notes,
    };

    setSubmitting(true);
    try {
      await fetchWithAuth(`/delivery/${activeTask.id}/report`, {
        method: 'POST',
        body: JSON.stringify({
          deliveredQty,
          emptyCollected,
          notes,
        }),
      });
      toast.success('Delivery log submitted successfully!');
      setActiveTask(null);
      loadTasks();
    } catch (err: any) {
      // Offline fallback: store in localStorage queue
      if (!window.navigator.onLine || err.message === 'Failed to fetch' || err.status === 0) {
        const queue = JSON.parse(localStorage.getItem('offline_delivery_reports') || '[]');
        queue.push(reportData);
        localStorage.setItem('offline_delivery_reports', JSON.stringify(queue));
        setOfflineQueueCount(queue.length);
        toast.success('Offline: Delivery log queued for sync!');
        setActiveTask(null);
        // Optimistic UI update
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeTask.id
              ? {
                ...t,
                report: {
                  partnerDeliveredQty: deliveredQty,
                  partnerEmptyCollected: emptyCollected,
                  partnerNotes: notes,
                },
              }
              : t
          )
        );
      } else {
        toast.error(err.message || 'Failed to submit delivery report');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Compute page title from path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/customers')) return 'Customers';
    if (path.includes('/orders')) return 'Orders';
    if (path.includes('/profits')) return 'Profits';
    if (path.includes('/profile')) return 'Profile';
    return 'Delivery Workspace';
  };



  const portalConfig = getPortalSidebarConfig('DELIVERY_PARTNER', {
    tasksCount: tasks.length,
  });

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#16324F] font-sans antialiased overflow-hidden">

      {/* ─── STANDARDIZED SHARED DESKTOP SIDEBAR ────────────────── */}
      <SharedSidebar
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
      />

      {/* ─── STANDARDIZED SHARED MOBILE DRAWER ──────────────────── */}
      <SharedMobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        portalLabel={portalConfig.portalLabel}
        sections={portalConfig.sections}
        homePath={portalConfig.homePath}
        profilePath={portalConfig.profilePath}
      />

      {/* ─── MAIN CONTENT WRAPPER ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header (64px) */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#64748B] hover:text-[#16324F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#16324F] tracking-tight">
                {getPageTitle()}
              </h1>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span>Delivery Partner</span>
                <span>/</span>
                <span className="text-[#1677C8] font-medium">{getPageTitle()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Online Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Online • Active Shift</span>
            </div>

            {/* Quick Refresh */}
            <button
              onClick={loadTasks}
              disabled={loading}
              title="Refresh assigned data"
              className="p-2 text-[#64748B] hover:text-[#1677C8] hover:bg-blue-50/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Driver Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <NavLink
                to="/delivery-partner/profile"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1677C8]/10 text-[#1677C8] font-bold text-xs hover:bg-[#1677C8]/20 transition-colors cursor-pointer"
                title="View Profile"
              >
                {user?.firstName?.[0] || 'D'}{user?.lastName?.[0] || 'P'}
              </NavLink>
              <button
                onClick={logout}
                className="hidden sm:inline-flex text-xs font-semibold text-[#64748B] hover:text-rose-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Page Container - Full Width Operational Layout */}
        <main className="flex-1 overflow-y-auto px-6 sm:px-8 py-6">
          <div className="w-full">
            {loading && tasks.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner fullPage label="Loading delivery workspace..." />
              </div>
            ) : (
              <Routes>
                <Route
                  index
                  element={
                    <Overview
                      tasks={tasks}
                      loading={loading}
                      onRefresh={loadTasks}
                      onOpenReportModal={openReportModal}
                      offlineQueueCount={offlineQueueCount}
                    />
                  }
                />
                <Route
                  path="customers"
                  element={<Customers tasks={tasks} loading={loading} />}
                />
                <Route
                  path="orders"
                  element={<Orders />}
                />
                <Route
                  path="profits"
                  element={<Profits tasks={tasks} loading={loading} />}
                />
                <Route
                  path="profile"
                  element={<Profile />}
                />
                <Route path="*" element={<Navigate to="/delivery-partner" replace />} />
              </Routes>
            )}
          </div>
        </main>
      </div>

      {/* ─── DRIVER DELIVERY REPORT MODAL ───────────────────────── */}
      <AnimatePresence>
        {activeTask && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#16324F]">Submit Delivery Log</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Stop {formatOrderId(activeTask.id)} • {activeTask.customer?.user?.firstName || 'Customer'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTask(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Delivered Quantity Counter */}
                <div>
                  <label className="block text-xs font-semibold text-[#16324F] uppercase tracking-wider mb-1.5">
                    Delivered Bottles (Full Jars)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliveredQty((prev) => Math.max(0, prev - 1))}
                      className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#16324F] font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-lg font-bold text-[#16324F]">{deliveredQty}</span>
                    <button
                      type="button"
                      onClick={() => setDeliveredQty((prev) => prev + 1)}
                      className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#16324F] font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-[#64748B] ml-2">
                      Required: {activeTask.requiredQuantity}
                    </span>
                  </div>
                </div>

                {/* Empty Jars Collected Counter */}
                <div>
                  <label className="block text-xs font-semibold text-[#16324F] uppercase tracking-wider mb-1.5">
                    Empty Jars Collected
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEmptyCollected((prev) => Math.max(0, prev - 1))}
                      className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#16324F] font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-lg font-bold text-[#16324F]">{emptyCollected}</span>
                    <button
                      type="button"
                      onClick={() => setEmptyCollected((prev) => prev + 1)}
                      className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#16324F] font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delivery Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[#16324F] uppercase tracking-wider mb-1.5">
                    Delivery Notes / Customer Feedback
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F] placeholder:text-gray-400 resize-none"
                    placeholder="e.g. Left at door step, customer paid cash, etc."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setActiveTask(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleReportSubmit}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Confirm Log</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
