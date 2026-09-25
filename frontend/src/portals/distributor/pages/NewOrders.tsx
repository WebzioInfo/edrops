import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  CreditCard,
  Calendar,
  Phone,
  MapPin,
  Flame,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Ban,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../../../api/client';
import { showToast } from '../../../utils/toast';
import { formatOrderId, formatOrderStatus } from '../../../utils/orderFormatters';
import { useSocket } from '../../../contexts/SocketContext';
import { DistributorTopbar } from '../components/DistributorTopbar';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';

export interface NewOrderItemRecord {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    price: number;
    isJar?: boolean;
  };
  quantity: number;
  unitPrice: number;
  deposit: number;
  total: number;
}

export interface NewOrderRecord {
  id: string;
  customerId: string;
  customer?: {
    id: string;
    user?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
    };
    companyName?: string | null;
  };
  orderType: string;
  orderSource: string;
  status: string;
  subTotal: number;
  depositTotal: number;
  deliveryCharge: number;
  discountTotal: number;
  totalAmount: number;
  totalQuantity?: number;
  address?: {
    id: string;
    street: string;
    houseName?: string;
    buildingName?: string;
    area?: string;
    landmark?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
    googleMapsUrl?: string;
  };
  timeSlot?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: NewOrderItemRecord[];
  isRecentlyAdded?: boolean;
}

interface QueueStats {
  queueCount: number;
  todayCount: number;
  totalQueueValue: number;
}

export default function NewOrders() {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [orders, setOrders] = useState<NewOrderRecord[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    queueCount: 0,
    todayCount: 0,
    totalQueueValue: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);
  const [skippingOrderId, setSkippingOrderId] = useState<string | null>(null);

  // Detail drawer
  const [selectedOrder, setSelectedOrder] = useState<NewOrderRecord | null>(null);
  const selectedOrderRef = useRef<NewOrderRecord | null>(null);
  selectedOrderRef.current = selectedOrder;

  const isFetchingRef = useRef(false);
  const activeActionRef = useRef<Set<string>>(new Set());

  // Fetch initial queue data (once on mount, then maintained strictly via real-time WebSocket events)
  const fetchQueue = async (showLoader = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (showLoader) setIsLoading(true);
    setIsError(false);
    setErrorMessage('');

    try {
      const res = await fetchWithAuth('/orders/distributor/new-orders');
      const orderList = Array.isArray(res?.data) ? res.data : [];
      setOrders(orderList);

      const resolvedStats: QueueStats = {
        queueCount: typeof res?.stats?.queueCount === 'number' ? res.stats.queueCount : orderList.length,
        todayCount: typeof res?.stats?.todayCount === 'number' ? res.stats.todayCount : 0,
        totalQueueValue: typeof res?.stats?.totalQueueValue === 'number' ? res.stats.totalQueueValue : 0,
      };
      setStats(resolvedStats);

      // Sync badge count to parent DistributorPortal
      window.dispatchEvent(
        new CustomEvent('edrops:queueCount', { detail: resolvedStats.queueCount }),
      );
    } catch (err: any) {
      console.error('[NewOrders] Error loading queue:', err);
      setIsError(true);
      const msg =
        err?.message ||
        (err?.status ? `Request failed with status ${err.status}` : 'Unable to load new orders queue.');
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchQueue(true);
  }, []);

  // Listen to WebSocket events for real-time queue management (NO POLLING)
  useEffect(() => {
    if (!socket) return;

    const handleNewOrderAvailable = (payload: { order: NewOrderRecord; notification?: any }) => {
      const newOrder = payload?.order;
      if (!newOrder || !newOrder.id) return;

      // Add highlight flag for visual cue
      const enrichedOrder: NewOrderRecord = {
        ...newOrder,
        isRecentlyAdded: true,
      };

      setOrders((prev) => {
        // Prevent duplicate insertion
        if (prev.some((o) => o.id === enrichedOrder.id)) return prev;
        return [enrichedOrder, ...prev];
      });

      setStats((prev) => {
        const nextQueue = prev.queueCount + 1;
        window.dispatchEvent(
          new CustomEvent('edrops:queueCount', { detail: nextQueue }),
        );
        return {
          queueCount: nextQueue,
          todayCount: prev.todayCount + 1,
          totalQueueValue: Number((prev.totalQueueValue + (enrichedOrder.totalAmount || 0)).toFixed(2)),
        };
      });

      // Audio notification if permitted
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {
        // Ignore audio play errors
      }

      showToast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-slate-900 border border-amber-500/40 shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/5 p-4 text-white`}
          >
            <div className="flex-1 w-0">
              <div className="flex items-start">
                <div className="shrink-0 pt-0.5">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    New Order In Queue!
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    Order #{formatOrderId(enrichedOrder.id)} • ₹{enrichedOrder.totalAmount}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {enrichedOrder.customer?.user?.firstName || 'Customer'} •{' '}
                    {enrichedOrder.address?.city || 'Local Delivery'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-slate-700 pl-3 ml-3 items-center">
              <button
                onClick={() => {
                  showToast.dismiss(t.id);
                  handleAcceptOrder(enrichedOrder.id);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Claim
              </button>
            </div>
          </div>
        ),
        { id: `new-order-toast-${enrichedOrder.id}`, duration: 8000 },
      );
    };

    const handleOrderClaimed = (payload: { orderId: string; assignedDistributorId: string }) => {
      const orderId = payload?.orderId;
      if (!orderId) return;

      setOrders((prev) => {
        const existing = prev.find((o) => o.id === orderId);
        if (!existing) return prev;

        setStats((s) => {
          const nextQueue = Math.max(0, s.queueCount - 1);
          window.dispatchEvent(
            new CustomEvent('edrops:queueCount', { detail: nextQueue }),
          );
          return {
            ...s,
            queueCount: nextQueue,
            totalQueueValue: Math.max(0, Number((s.totalQueueValue - (existing.totalAmount || 0)).toFixed(2))),
          };
        });

        return prev.filter((o) => o.id !== orderId);
      });

      if (selectedOrderRef.current && selectedOrderRef.current.id === orderId) {
        setSelectedOrder(null);
        showToast.info('Order was claimed by another distributor.', {
          id: `order-claimed-${orderId}`,
          style: { background: '#1E293B', color: '#F8FAFC' },
        });
      }
    };

    socket.on('NEW_ORDER_AVAILABLE', handleNewOrderAvailable);
    socket.on('ORDER_CLAIMED', handleOrderClaimed);

    return () => {
      socket.off('NEW_ORDER_AVAILABLE', handleNewOrderAvailable);
      socket.off('ORDER_CLAIMED', handleOrderClaimed);
    };
  }, [socket]);

  // Atomic Order Claim Action
  const handleAcceptOrder = async (orderId: string) => {
    if (activeActionRef.current.has(orderId) || claimingOrderId || skippingOrderId) return;
    activeActionRef.current.add(orderId);
    setClaimingOrderId(orderId);

    try {
      await fetchWithAuth(`/orders/distributor/${orderId}/accept`, {
        method: 'POST',
      });

      // Successfully claimed!
      showToast.success(
        (t) => (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">Order #{formatOrderId(orderId)} Accepted!</p>
              <p className="text-xs text-slate-200 mt-0.5">Assigned to your operational orders.</p>
            </div>
            <button
              onClick={() => {
                showToast.dismiss(t.id);
                navigate('/distributor/orders');
              }}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded font-bold text-xs shrink-0 cursor-pointer"
            >
              View Orders
            </button>
          </div>
        ),
        { id: `accept-order-${orderId}`, duration: 5000 },
      );

      // Remove from queue
      setOrders((prev) => {
        const targetOrder = prev.find((o) => o.id === orderId);
        setStats((s) => {
          const nextCount = Math.max(0, s.queueCount - 1);
          window.dispatchEvent(
            new CustomEvent('edrops:queueCount', { detail: nextCount }),
          );
          return {
            ...s,
            queueCount: nextCount,
            totalQueueValue: Math.max(
              0,
              Number((s.totalQueueValue - (targetOrder?.totalAmount || 0)).toFixed(2)),
            ),
          };
        });
        return prev.filter((o) => o.id !== orderId);
      });

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (err: any) {
      if (err.status === 409) {
        // Race condition: Another distributor claimed it first
        showToast.error(err.message || 'This order has already been accepted by another distributor.', {
          id: `conflict-order-${orderId}`,
          duration: 5000,
        });

        // Immediately purge from current view
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setStats((prev) => {
          const nextCount = Math.max(0, prev.queueCount - 1);
          window.dispatchEvent(
            new CustomEvent('edrops:queueCount', { detail: nextCount }),
          );
          return {
            ...prev,
            queueCount: nextCount,
          };
        });

        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(null);
        }
        return;
      }

      console.error('[NewOrders] Accept error:', err);
      showToast.error(err.message || 'Could not accept order.', {
        id: `accept-error-${orderId}`,
      });
    } finally {
      activeActionRef.current.delete(orderId);
      setClaimingOrderId(null);
    }
  };

  // Distributor-specific Skip Order Action
  const handleSkipOrder = async (orderId: string) => {
    if (activeActionRef.current.has(orderId) || skippingOrderId || claimingOrderId) return;
    activeActionRef.current.add(orderId);
    setSkippingOrderId(orderId);

    try {
      await fetchWithAuth(`/orders/distributor/${orderId}/skip`, {
        method: 'POST',
      });

      // Remove from current distributor's queue
      setOrders((prev) => {
        const skippedOrder = prev.find((o) => o.id === orderId);
        setStats((s) => {
          const nextQueue = Math.max(0, s.queueCount - 1);
          window.dispatchEvent(
            new CustomEvent('edrops:queueCount', { detail: nextQueue }),
          );
          return {
            ...s,
            queueCount: nextQueue,
            totalQueueValue: Math.max(
              0,
              Number((s.totalQueueValue - (skippedOrder?.totalAmount || 0)).toFixed(2)),
            ),
          };
        });
        return prev.filter((o) => o.id !== orderId);
      });

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }

      showToast.success(`Order #${formatOrderId(orderId)} skipped from your queue`, {
        id: `skip-order-${orderId}`,
      });
    } catch (err: any) {
      console.error('[NewOrders] Skip error:', err);
      showToast.error(err?.message || 'Could not skip order.', {
        id: `skip-error-${orderId}`,
      });
    } finally {
      activeActionRef.current.delete(orderId);
      setSkippingOrderId(null);
    }
  };

  // Client-side search filtering
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      const idMatch = o.id.toLowerCase().includes(q) || formatOrderId(o.id).toLowerCase().includes(q);
      const custName = `${o.customer?.user?.firstName || ''} ${o.customer?.user?.lastName || ''}`.toLowerCase();
      const nameMatch = custName.includes(q);
      const phoneMatch = (o.customer?.user?.phone || '').toLowerCase().includes(q);
      const cityMatch = (o.address?.city || '').toLowerCase().includes(q);
      const streetMatch = (o.address?.street || '').toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch || cityMatch || streetMatch;
    });
  }, [orders, search]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt || 0);
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now.getTime() - past.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      return past.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] pb-16 animate-in fade-in duration-150">
      {/* ─── STANDARDIZED DISTRIBUTOR TOPBAR ──────────────────────── */}
      <DistributorTopbar
        title="New Orders Queue"
        subtitle="Unassigned incoming customer orders available to claim. First distributor to accept gets the order."
        icon={Flame}
        iconVariant="amber"
        
        actions={
          <>
            {/* Realtime WebSocket Indicator */}
            

            <button
              onClick={() => fetchQueue(true)}
              disabled={isLoading}
              title="Refresh Queue"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span className="hidden sm:inline ml-1.5">Refresh</span>
            </button>
          </>
        }
      />

      <div className="w-full p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 flex-1">
        {isLoading && orders.length === 0 ? (
          <EdropsPageLoader minHeight="min-h-[50vh]" />
        ) : (
          <>
            {/* ─── LIVE METRIC CARDS (2-COL RESPONSIVE) ───────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider">Queue Available</p>
                  <p className="text-xl sm:text-2xl font-black text-amber-700 leading-tight mt-0.5">{stats.queueCount}</p>
                </div>
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-sky-200/80 bg-sky-50/40 flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase tracking-wider">Incoming Today</p>
                  <p className="text-xl sm:text-2xl font-black text-[#0088CC] leading-tight mt-0.5">{stats.todayCount}</p>
                </div>
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-sky-500/15 text-[#0088CC] flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/40 flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Queue Value</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 leading-tight mt-0.5">
                    {formatCurrency(stats.totalQueueValue)}
                  </p>
                </div>
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

            {/* ─── SEARCH & FILTER TOOLBAR ───────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search queue by Order #, Customer, Phone, City..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1677C8] focus:bg-white text-[#16324F] placeholder-slate-400 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs font-semibold text-slate-500 w-full sm:w-auto flex justify-between sm:justify-end items-center gap-2">
                <span>
                  Showing <strong className="text-slate-800">{filteredOrders.length}</strong> available orders
                </span>
              </div>
            </div>

        {/* ─── QUEUE TABLE / LIST ────────────────────────────────────────────── */}
        <div>
        {isError ? (
          <div className="bg-white rounded-xl border border-rose-200 p-8 text-center shadow-2xs">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-rose-700">Failed to load order queue</p>
            <p className="text-xs text-rose-500 mt-1">{errorMessage}</p>
            <button
              onClick={() => fetchQueue(true)}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
            >
              Retry
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-2xs">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#16324F]">No new orders</h3>
            <p className="text-xs text-[#64748B] max-w-md mx-auto mt-1">
              There are no unassigned customer orders right now. When a customer completes checkout or places an order, it will appear here in real-time.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Real-time listener active — No manual refresh needed</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-[#E2E8F0] text-[#64748B] font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Order ID & Age</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Delivery Location</th>
                    <th className="py-3 px-4">Items / Jars</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOrders.map((order) => {
                    const totalQty = order.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
                    const isClaiming = claimingOrderId === order.id;

                    return (
                      <tr
                        key={order.id}
                        className={`transition-colors hover:bg-slate-50/60 ${
                          order.isRecentlyAdded ? 'bg-amber-50/50 animate-pulse' : ''
                        }`}
                      >
                        {/* Order ID & Age */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[#16324F]">
                              #{formatOrderId(order.id)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {formatOrderStatus(order.status)}
                            </span>
                            {order.isRecentlyAdded && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500 text-white animate-bounce">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-[#64748B] mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{getRelativeTime(order.createdAt)}</span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#16324F]">
                            {order.customer?.user
                              ? `${order.customer.user.firstName || ''} ${order.customer.user.lastName || ''}`.trim()
                              : 'Customer'}
                          </div>
                          {order.customer?.user?.phone && (
                            <div className="flex items-center gap-1 text-[11px] text-[#64748B] mt-0.5">
                              <Phone className="w-3 h-3" />
                              <span>{order.customer.user.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Delivery Location */}
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-1 text-[#16324F] font-semibold max-w-[200px] truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="truncate">
                              {order.address?.street || order.address?.area || 'Local Delivery'}
                              {order.address?.city ? `, ${order.address.city}` : ''}
                            </span>
                          </div>
                          {order.timeSlot && (
                            <p className="text-[10px] text-slate-500 mt-0.5 pl-4">
                              Slot: {order.timeSlot}
                            </p>
                          )}
                        </td>

                        {/* Items / Jars */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[#16324F] font-bold text-[11px]">
                            <Package className="w-3 h-3 text-[#1677C8]" />
                            {totalQty} {totalQty === 1 ? 'Jar' : 'Jars'}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                            {order.items?.map((i) => i.product?.name || 'Product').join(', ')}
                          </p>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3 px-4">
                          <div className="font-black text-[#16324F] text-sm">
                            {formatCurrency(order.totalAmount)}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Subtotal: {formatCurrency(order.subTotal)}
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {order.paymentMethod || 'COD'} • {order.paymentStatus}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition"
                              title="View Order Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleSkipOrder(order.id)}
                              disabled={skippingOrderId === order.id || isClaiming}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 font-bold rounded-lg text-xs transition border border-slate-300 disabled:opacity-50 cursor-pointer"
                              title="Skip this order (removes from your queue only)"
                            >
                              {skippingOrderId === order.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                              ) : (
                                <Ban className="w-3.5 h-3.5 text-slate-500" />
                              )}
                              <span>Skip</span>
                            </button>

                            <button
                              onClick={() => handleAcceptOrder(order.id)}
                              disabled={isClaiming || skippingOrderId === order.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-2xs disabled:opacity-50 cursor-pointer"
                              title="Accept and claim this order"
                            >
                              {isClaiming ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Claiming...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Accept</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ─── Mobile Card List View ─────────────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const totalQty = order.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
                const isClaiming = claimingOrderId === order.id;
                const isSkipping = skippingOrderId === order.id;
                const customerName = order.customer?.user
                  ? `${order.customer.user.firstName || ''} ${order.customer.user.lastName || ''}`.trim()
                  : 'Customer';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-3.5 transition cursor-pointer space-y-2 relative ${
                      order.isRecentlyAdded ? 'bg-amber-50/70 border-l-3 border-amber-500' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Top Line: Customer Name (left) + NEW/Status badge & Time (right) */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-[#16324F] truncate">
                        {customerName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {order.isRecentlyAdded ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500 text-white">
                            NEW
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {formatOrderStatus(order.status)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {getRelativeTime(order.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Second Line: Amount • Jars • Location */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="text-slate-600 font-medium">
                        <span className="font-bold text-[#16324F]">
                          {formatCurrency(order.totalAmount)}
                        </span>
                        <span className="mx-1 text-slate-300">•</span>
                        <span>{totalQty} {totalQty === 1 ? 'Jar' : 'Jars'}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 truncate max-w-[140px] text-right">
                        {order.address?.city || order.address?.area || 'Local'}
                      </span>
                    </div>

                    {/* Third Line: Compact Actions */}
                    <div
                      className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSkipOrder(order.id)}
                        disabled={isSkipping || isClaiming}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition disabled:opacity-50 cursor-pointer text-xs font-semibold flex items-center gap-1"
                        title="Skip order"
                      >
                        {isSkipping ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5 text-slate-400" />
                            <span>Skip</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={isClaiming || isSkipping}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-2xs disabled:opacity-50 cursor-pointer"
                        title="Accept and claim order"
                      >
                        {isClaiming ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
            </div>
          </>
        )}
      </div>

      {/* ─── SLIDE-OVER DETAILS DRAWER ─────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#16324F]">
                    Order #{formatOrderId(selectedOrder.id)}
                  </h2>
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                    <span>Status:</span>
                    <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {formatOrderStatus(selectedOrder.status)}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-[#16324F] hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Customer Info Card */}
              <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-slate-50/50 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                  Customer Information
                </p>
                <div className="space-y-1">
                  <p className="font-bold text-[#16324F] text-sm">
                    {selectedOrder.customer?.user
                      ? `${selectedOrder.customer.user.firstName || ''} ${selectedOrder.customer.user.lastName || ''}`.trim()
                      : 'Customer'}
                  </p>
                  {selectedOrder.customer?.user?.phone && (
                    <div className="flex items-center gap-1.5 text-[#64748B]">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedOrder.customer.user.phone}</span>
                    </div>
                  )}
                  {selectedOrder.customer?.user?.email && (
                    <p className="text-[#64748B] pl-5">{selectedOrder.customer.user.email}</p>
                  )}
                </div>
              </div>

              {/* Delivery Address Card */}
              <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                    Delivery Location
                  </p>
                  {selectedOrder.address?.googleMapsUrl && (
                    <a
                      href={selectedOrder.address.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1677C8] hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-[#16324F] space-y-0.5">
                  <p className="font-semibold">{selectedOrder.address?.street || 'Standard Location'}</p>
                  {selectedOrder.address?.area && <p>{selectedOrder.address.area}</p>}
                  <p>
                    {[selectedOrder.address?.city, selectedOrder.address?.district, selectedOrder.address?.state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {selectedOrder.address?.zipCode && <p>PIN: {selectedOrder.address.zipCode}</p>}
                </div>
                {selectedOrder.timeSlot && (
                  <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center gap-1 text-[11px] text-[#64748B]">
                    <Clock className="w-3.5 h-3.5 text-[#1677C8]" />
                    <span>Requested Delivery Slot: <strong>{selectedOrder.timeSlot}</strong></span>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                  Order Items ({selectedOrder.items?.length || 0})
                </p>
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between bg-white">
                      <div>
                        <p className="font-bold text-[#16324F]">{item.product?.name || 'Product'}</p>
                        <p className="text-[11px] text-[#64748B]">
                          Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                          {item.deposit > 0 && ` (+ Deposit: ${formatCurrency(item.deposit)})`}
                        </p>
                      </div>
                      <p className="font-bold text-[#16324F] text-xs">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Calculation Summary */}
              <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-slate-50/50 space-y-1.5">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subTotal)}</span>
                </div>
                {selectedOrder.depositTotal > 0 && (
                  <div className="flex justify-between text-[#64748B]">
                    <span>Jar Deposit</span>
                    <span>{formatCurrency(selectedOrder.depositTotal)}</span>
                  </div>
                )}
                {selectedOrder.deliveryCharge > 0 && (
                  <div className="flex justify-between text-[#64748B]">
                    <span>Delivery Charge</span>
                    <span>{formatCurrency(selectedOrder.deliveryCharge)}</span>
                  </div>
                )}
                {selectedOrder.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedOrder.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-[#16324F] pt-2 border-t border-slate-200">
                  <span>Total Order Value</span>
                  <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-[#64748B]">Payment Method:</span>
                  <span className="font-bold text-[#16324F]">
                    {selectedOrder.paymentMethod || 'COD'} ({selectedOrder.paymentStatus})
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer with Close, Skip, and Accept Buttons */}
            <div className="p-4 border-t border-[#E2E8F0] bg-white flex items-center justify-between gap-2.5">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-[#16324F] font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2 flex-1 justify-end">
                <button
                  onClick={() => handleSkipOrder(selectedOrder.id)}
                  disabled={skippingOrderId === selectedOrder.id || claimingOrderId === selectedOrder.id}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                  title="Skip this order from your queue"
                >
                  {skippingOrderId === selectedOrder.id ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                      <span>Skipping...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5 text-slate-500" />
                      <span>Skip Order</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleAcceptOrder(selectedOrder.id)}
                  disabled={claimingOrderId === selectedOrder.id || skippingOrderId === selectedOrder.id}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {claimingOrderId === selectedOrder.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Claiming Order...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept & Claim</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
