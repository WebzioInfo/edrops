import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../../contexts/SocketContext';
import {
  ShoppingCart,
  Search,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import OrderRow, { type Distributor } from '../components/OrderRow';
import { formatOrderId, getOrderPaymentState } from '../../../utils/orderFormatters';
import { DataErrorState } from '../../../components/common/DataErrorState';

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED';

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OrderStats {
  totalOrders: number;
  pendingCount: number;
  activeCount: number;
  todayCount: number;
  totalRevenue: number;
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Staff Collection Modal state
  const [collectingOrder, setCollectingOrder] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<string>('CASH');
  const [collectRefNumber, setCollectRefNumber] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [isSubmittingCollection, setIsSubmittingCollection] = useState<boolean>(false);

  // Filters & Pagination
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });

  const [, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingCount: 0,
    activeCount: 0,
    todayCount: 0,
    totalRevenue: 0,
  });

  const { socket } = useSocket();

  // Load Orders from backend with pagination & filters
  const loadOrders = useCallback(async (isSilent = false) => {
    try {
      setError(null);
      if (!isSilent) {
        if (orders.length === 0) setLoading(true);
        else setRefreshing(true);
      }

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (activeFilter !== 'ALL') {
        params.set('status', activeFilter);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetchWithAuth(`/order/staff/all?${params.toString()}`);

      if (res && res.data && Array.isArray(res.data)) {
        setOrders(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
        if (res.stats) {
          setStats(res.stats);
        }
      } else if (Array.isArray(res)) {
        // Fallback for direct array response
        setOrders(res);
        setPagination({
          total: res.length,
          page: 1,
          limit: res.length || 15,
          totalPages: 1,
        });
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, activeFilter, searchQuery, orders.length]);

  // Load active distributors only (role = DISTRIBUTOR)
  const loadDistributors = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/staff/distributors');
      setDistributors(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Failed to load distributors:', err);
    }
  }, []);

  useEffect(() => {
    loadDistributors();
  }, [loadDistributors]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Consolidated Real-time WebSocket subscriptions
  useEffect(() => {
    if (!socket) return;

    const handleOrderAssigned = (data: any) => {
      const orderId = data?.orderId || data?.id || data?.order?.id;
      if (!orderId) {
        loadOrders(true);
        return;
      }

      const targetDistId = data?.distributorId || data?.order?.distributorId;
      const foundDist = targetDistId ? distributors.find(d => d.id === targetDistId || d.userId === targetDistId) : null;
      const distObj =
        data?.distributor ||
        data?.order?.distributor ||
        (foundDist ? ((foundDist as any).user || foundDist) : undefined);

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              ...(data.order || {}),
              status: data?.status || data?.order?.status || 'CONFIRMED',
              distributorId: targetDistId || o.distributorId,
              assignmentStatus: 'ASSIGNED',
              distributor: distObj || o.distributor,
            };
          }
          return o;
        })
      );

      const orderShortId = formatOrderId(orderId);
      const distName = distObj ? `${distObj.firstName || ''} ${distObj.lastName || ''}`.trim() || 'Distributor' : 'Distributor';
      toast.success(`Order ${orderShortId} confirmed & assigned to ${distName}`, { icon: '🤝', id: `assign-${orderId}` });
    };

    const handleStatusChanged = (data: any) => {
      const orderId = data?.orderId || data?.order?.id || data?.id;
      const status = data?.status || data?.order?.status;
      if (orderId) {
        const targetDistId = data.distributorId || data?.order?.distributorId;
        const foundDist = targetDistId ? distributors.find(d => d.id === targetDistId || d.userId === targetDistId) : null;
        const distObj =
          data.distributor ||
          data?.order?.distributor ||
          (foundDist ? ((foundDist as any).user || foundDist) : undefined);

        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                ...(data.order || {}),
                status: status || o.status,
                distributorId: targetDistId || o.distributorId,
                assignmentStatus: data.assignmentStatus || data?.order?.assignmentStatus || o.assignmentStatus,
                distributor: distObj || o.distributor,
              };
            }
            return o;
          })
        );
      } else {
        loadOrders(true);
      }
    };

    const handleOrderUpdated = (data: any) => {
      if (data?.id) {
        setOrders((prev) => prev.map((o) => (o.id === data.id ? { ...o, ...data } : o)));
      } else {
        loadOrders(true);
      }
    };

    const handleNewOrderEvent = () => {
      loadOrders(true);
      toast.success('New order received!', { icon: '📦', id: 'new-order-toast' });
    };

    socket.on('order:assigned', handleOrderAssigned);
    socket.on('order:claimed', handleOrderAssigned);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('NEW_ORDER', handleNewOrderEvent);

    return () => {
      socket.off('order:assigned', handleOrderAssigned);
      socket.off('order:claimed', handleOrderAssigned);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('NEW_ORDER', handleNewOrderEvent);
    };
  }, [socket, loadOrders, distributors]);

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: string, paymentConfirmation?: any, reason?: string) => {
    const currentOrder = orders.find(o => o.id === orderId);
    if (currentOrder && currentOrder.status === newStatus) {
      toast(`Order is already in status ${newStatus}`, { icon: 'ℹ️' });
      return;
    }
    try {
      // Optimistic update
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: newStatus,
            paymentStatus: paymentConfirmation?.paymentReceived ? 'SUCCESS' : o.paymentStatus,
            paymentCollected: !!paymentConfirmation?.paymentReceived,
            ...(newStatus === 'CANCELLED' ? { cancellationReason: reason } : {}),
          };
        }
        return o;
      }));

      await fetchWithAuth(`/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          paymentConfirmation,
          reason,
        }),
      });
      toast.success(`Order ${formatOrderId(orderId)} updated successfully`, { id: 'order-action-toast' });
      loadOrders(true);
    } catch (err: any) {
      if (!err?.handledToast && err?.status !== 500) {
        toast.error(err.message || 'Failed to update status', { id: 'order-action-toast' });
      }
      loadOrders(true); // Revert
    }
  };

  // Handle distributor assignment
  const handleAssignDistributor = async (orderId: string, distributorId: string) => {
    if (!distributorId) return;
    setAssigningOrderId(orderId);
    try {
      const assignedDistributor = distributors.find(d => d.id === distributorId || d.userId === distributorId);

      const res = await fetchWithAuth(`/staff/orders/${orderId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ distributorId }),
      });

      const updatedOrder = res?.order || res;

      // Update state only after server successfully persists assignment
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'CONFIRMED',
            distributorId,
            assignmentStatus: 'ASSIGNED',
            distributor: (assignedDistributor as any)?.user || assignedDistributor || o.distributor,
            ...(updatedOrder?.id ? updatedOrder : {}),
          };
        }
        return o;
      }));

      const u = (assignedDistributor as any)?.user || assignedDistributor;
      const distName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Distributor' : 'Distributor';
      toast.success(`Assigned to ${distName}`, { id: 'order-action-toast' });
      loadOrders(true);
    } catch (err: any) {
      if (!err?.handledToast && err?.status !== 500) {
        toast.error(err.message || 'Failed to assign distributor', { id: 'order-action-toast' });
      }
      loadOrders(true); // Revert
      throw err; // Re-throw so caller in OrderRow can prevent chaining
    } finally {
      setAssigningOrderId(null);
    }
  };

  // Staff Payment Collection Handlers
  const handleOpenCollect = (order: any) => {
    setCollectingOrder(order);
    const pst = getOrderPaymentState(order);
    setCollectAmount(String(pst.due));
    setCollectMethod(order.paymentMethod || 'CASH');
    setCollectRefNumber('');
    setCollectNotes('');
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingOrder) return;
    const amt = Number(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid positive collection amount');
      return;
    }
    const pst = getOrderPaymentState(collectingOrder);
    if (amt > pst.due + 0.01) {
      toast.error(`Amount ₹${amt} exceeds remaining balance due (₹${pst.due})`);
      return;
    }

    try {
      setIsSubmittingCollection(true);
      const idempotencyKey = `COLLECT-STAFF-${collectingOrder.id}-${Date.now()}`;
      await fetchWithAuth(`/orders/${collectingOrder.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          paymentMethod: collectMethod,
          referenceNumber: collectRefNumber.trim() || undefined,
          notes: collectNotes.trim() || undefined,
          idempotencyKey,
        }),
      });

      toast.success(`Payment of ₹${amt} collected successfully!`);
      setCollectingOrder(null);
      loadOrders(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  // Display calculations
  const totalDisplayOrders = pagination.total || orders.length;
  const startOrderIndex = totalDisplayOrders === 0 ? 0 : (page - 1) * limit + 1;
  const endOrderIndex = Math.min(page * limit, totalDisplayOrders);

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Orders List & Controls Container */}
      <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Controls Header: Tabs + Search + Live indicator */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-slate-50/80 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {(['ALL', 'PENDING', 'ACTIVE', 'DELIVERED', 'CANCELLED'] as StatusFilter[]).map((tab) => {
              const label = tab === 'ALL' ? 'All Orders' : tab === 'PENDING' ? 'New / Placed' : tab === 'ACTIVE' ? 'Active' : tab === 'DELIVERED' ? 'Delivered' : 'Cancelled';
              const isActive = activeFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveFilter(tab);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#1E88E5] text-white shadow-2xs'
                      : 'bg-white text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search Bar & Refresh */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search order ID, name, phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-xl outline-none focus:border-[#1E88E5] text-[#0F172A]"
              />
            </div>

            <button
              type="button"
              onClick={() => loadOrders()}
              disabled={refreshing}
              title="Refresh Orders"
              className="p-2 text-[#64748B] hover:text-[#1E88E5] hover:bg-white bg-white border border-[#CBD5E1] rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hidden lg:flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
        </div>

        {/* Order Rows (Collapsed by default, Expandable on Manage) */}
        <div className="divide-y divide-[#E2E8F0]">
          {loading && orders.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <LoadingSpinner size="md" label="Loading order feed..." />
            </div>
          ) : error && orders.length === 0 ? (
            <div className="p-6">
              <DataErrorState
                title="Unable to load orders"
                message={error}
                onRetry={() => loadOrders()}
              />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E88E5] flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">No orders found</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                {searchQuery || activeFilter !== 'ALL'
                  ? 'No orders match your active search or status filters.'
                  : 'New orders will appear here automatically in real time.'}
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                distributors={distributors}
                isExpanded={expandedOrderId === order.id}
                onToggleExpand={() => toggleExpand(order.id)}
                onStatusUpdate={handleStatusUpdate}
                onAssignDistributor={handleAssignDistributor}
                onCollect={handleOpenCollect}
                isAssigning={assigningOrderId === order.id}
              />
            ))
          )}
        </div>

        {/* 4. PAGINATION FOOTER */}
        {totalDisplayOrders > 0 && (
          <div className="p-4 sm:px-6 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[#64748B] font-medium">
              Showing <span className="font-bold text-[#0F172A]">{startOrderIndex}</span> to{' '}
              <span className="font-bold text-[#0F172A]">{endOrderIndex}</span> of{' '}
              <span className="font-bold text-[#0F172A]">{totalDisplayOrders}</span> orders
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-[#CBD5E1] rounded-xl hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {/* Page Number Chips */}
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => {
                    const isCurrent = p === page;
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;

                    return (
                      <div key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-xs text-[#94A3B8] px-1">...</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#1E88E5] text-white shadow-2xs'
                              : 'bg-white text-[#64748B] hover:bg-[#F1F5F9] border border-[#CBD5E1]'
                          }`}
                        >
                          {p}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-2.5 py-1.5 text-xs font-bold text-[#64748B] bg-white border border-[#CBD5E1] rounded-xl hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── MODAL: STAFF PAYMENT COLLECTION ───────────────────────── */}
      {collectingOrder && (() => {
        const pst = getOrderPaymentState(collectingOrder);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    Collect Payment
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Order: <span className="font-bold text-slate-800">#ORD-{formatOrderId(collectingOrder.id)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectingOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCollectSubmit} className="space-y-4">
                {/* Authoritative Financial Breakdown Card */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Total Order Amount:</span>
                    <span className="font-bold text-slate-800">₹{pst.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Already Paid:</span>
                    <span className="font-bold text-emerald-600">₹{pst.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/70 font-black text-xs">
                    <span className="text-orange-700">Outstanding Balance Due:</span>
                    <span className="text-orange-700">₹{pst.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5 text-[11px]">
                    <span className="text-slate-500 font-medium">Current Status:</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${pst.badgeClass}`}>
                      {pst.canonicalStatus === 'PAID' ? 'PAID' : pst.canonicalStatus === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount Collected (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={pst.due}
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    required
                    placeholder={`Enter amount up to ₹${pst.due}`}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>Allows full or partial collection</span>
                    <button
                      type="button"
                      onClick={() => setCollectAmount(String(pst.due))}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Collect Full (₹{pst.due})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reference / Receipt Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / Receipt #..."
                    value={collectRefNumber}
                    onChange={(e) => setCollectRefNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Collection notes..."
                    value={collectNotes}
                    onChange={(e) => setCollectNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCollectingOrder(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCollection}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{isSubmittingCollection ? 'Collecting...' : 'Collect Payment'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
