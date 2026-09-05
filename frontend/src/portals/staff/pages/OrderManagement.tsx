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
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import OrderRow, { type DeliveryPartner } from '../components/OrderRow';
import { formatOrderId } from '../../../utils/orderFormatters';
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
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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

  // Load active delivery partners
  const loadPartners = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/staff/delivery-partners');
      setPartners(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Failed to load delivery partners:', err);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    if (!socket) return;

    const handleOrderAssigned = (data: any) => {
      const orderShortId = data?.id ? formatOrderId(data.id) : '';
      toast.success(`Order assigned${orderShortId ? ` (${orderShortId})` : ''}`, { icon: '🛵' });
      loadOrders(true);
    };

    const handleOrderUpdated = (data: any) => {
      if (data?.id && data?.status) {
        setOrders(prev => prev.map(o => o.id === data.id ? { ...o, ...data } : o));
      } else {
        loadOrders(true);
      }
    };

    const handleStatusChanged = (data: any) => {
      const orderId = data?.orderId || data?.order?.id;
      const status = data?.status || data?.order?.status;
      if (orderId && status) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, ...(data.order || {}) } : o));
      } else {
        loadOrders(true);
      }
    };

    socket.on('order:assigned', handleOrderAssigned);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('NEW_ORDER', () => loadOrders(true));

    return () => {
      socket.off('order:assigned', handleOrderAssigned);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('NEW_ORDER');
    };
  }, [socket, loadOrders]);

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: string, paymentConfirmation?: any) => {
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
          };
        }
        return o;
      }));

      await fetchWithAuth(`/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          paymentConfirmation,
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

  // Handle delivery partner assignment
  const handleAssignPartner = async (orderId: string, deliveryPartnerId: string) => {
    if (!deliveryPartnerId) return;
    setAssigningOrderId(orderId);
    try {
      const assignedPartner = partners.find(p => p.id === deliveryPartnerId);

      await fetchWithAuth(`/staff/orders/${orderId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ deliveryPartnerId }),
      });

      // Update state only after server successfully persists assignment
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: ['NEW', 'PENDING', 'PENDING_ASSIGNMENT'].includes(o.status) ? 'ASSIGNED' : o.status,
            delivery: {
              ...o.delivery,
              assignment: {
                ...o.delivery?.assignment,
                deliveryPartnerId,
                deliveryPartner: assignedPartner,
              },
            },
          };
        }
        return o;
      }));

      const partnerName = assignedPartner ? `${assignedPartner.user.firstName} ${assignedPartner.user.lastName}` : 'Partner';
      toast.success(`Assigned to ${partnerName}`, { id: 'order-action-toast' });
      loadOrders(true);
    } catch (err: any) {
      if (!err?.handledToast && err?.status !== 500) {
        toast.error(err.message || 'Failed to assign delivery partner', { id: 'order-action-toast' });
      }
      loadOrders(true); // Revert
      throw err; // Re-throw so caller in OrderRow can prevent chaining
    } finally {
      setAssigningOrderId(null);
    }
  };

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;

    const handleNewOrderEvent = () => {
      loadOrders(true);
      toast.success('New order received!', { icon: '📦' });
    };

    const handleStatusChanged = (data: { orderId: string; status: string; order?: any }) => {
      setOrders(prev => prev.map(o => {
        if (o.id === data.orderId) {
          return data.order ? { ...o, ...data.order } : { ...o, status: data.status };
        }
        return o;
      }));
    };

    const handleOrderUpdated = (data: any) => {
      if (!data?.id) return;
      setOrders(prev => {
        const exists = prev.some(o => o.id === data.id);
        if (exists) {
          return prev.map(o => o.id === data.id ? { ...o, ...data } : o);
        }
        return [data, ...prev];
      });
    };

    const handleOrderAssigned = (data: any) => {
      const order = data.order || data;
      if (!order?.id) return;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...order } : o));
    };

    socket.on('NEW_ORDER', handleNewOrderEvent);
    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('order:assigned', handleOrderAssigned);

    return () => {
      socket.off('NEW_ORDER', handleNewOrderEvent);
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('order:assigned', handleOrderAssigned);
    };
  }, [socket, loadOrders]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  // Display calculations
  const totalDisplayOrders = pagination.total || orders.length;
  const startOrderIndex = totalDisplayOrders === 0 ? 0 : (page - 1) * limit + 1;
  const endOrderIndex = Math.min(page * limit, totalDisplayOrders);

  return (
    <main className="min-h-screen px-4 py-5 text-[#245361] sm:px-6 lg:px-10 space-y-4">
      {/* Header (Plain text, no card wrapper) */}
      <div className="pt-1 pb-0.5">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#245361]">
          Order Management
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
          Real-time feed of all customer orders. Updates automatically.
        </p>
      </div>

      {/* Orders List & Controls Container */}
      <section className="bg-white rounded-3xl shadow-xs border border-[#E2E8F0] overflow-hidden">
        {/* Controls Header: Tabs + Search + Live indicator */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
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
                partners={partners}
                isExpanded={expandedOrderId === order.id}
                onToggleExpand={() => toggleExpand(order.id)}
                onStatusUpdate={handleStatusUpdate}
                onAssignPartner={handleAssignPartner}
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
    </main>
  );
}
