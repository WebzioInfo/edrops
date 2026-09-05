import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ShoppingBag,
  Search,
  RotateCw,
  ChevronLeft,
  FileText,
  X,
  Filter,
  Package
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { toast } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatOrderId,
  formatDeliverySlot,
  formatPaymentDetails
} from '../../../utils/orderFormatters';
import { generateOrderInvoice } from '../../../utils/InvoiceGenerator';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { DataErrorState } from '../../../components/common/DataErrorState';

type StatusFilterType = 'ALL' | 'ON_THE_WAY' | 'DELIVERED' | 'CONFIRMED' | 'CANCELLED';
type TimeFilterType = 'ALL' | 'LAST_30_DAYS' | 'YEAR_2026' | 'OLDER';

export default function Orders() {
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputText, setSearchInputText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('ALL');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchCustomerOrders = useCallback(async (): Promise<any[]> => {
    const orderData = await fetchWithAuth('/order');
    return Array.isArray(orderData) ? orderData : [];
  }, []);

  const {
    data: ordersData,
    error,
    isLoading,
    isError,
    reload: loadOrders,
    setData: setOrders,
  } = useDataFetch<any[]>(fetchCustomerOrders);

  const orders = useMemo(() => ordersData || [], [ordersData]);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!socket) return;

    const handleStatusChanged = (data: { orderId: string; status: string }) => {
      setOrders((prev) =>
        (prev || []).map((o: any) => (o.id === data.orderId ? { ...o, status: data.status } : o))
      );
      toast.success(`Order ${formatOrderId(data.orderId)} updated`, { icon: '📦' });
    };

    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('NEW_ORDER', () => loadOrders(true));

    return () => {
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('NEW_ORDER');
    };
  }, [socket, loadOrders, setOrders]);

  // Counts for status filters
  const counts = useMemo(() => {
    const res = {
      ALL: orders.length,
      ON_THE_WAY: 0,
      DELIVERED: 0,
      CONFIRMED: 0,
      CANCELLED: 0,
    };

    for (const o of orders) {
      const s = (o.status || '').toUpperCase();
      if (s === 'OUT_FOR_DELIVERY') res.ON_THE_WAY += 1;
      else if (['DELIVERED', 'COMPLETED'].includes(s)) res.DELIVERED += 1;
      else if (['CONFIRMED', 'ASSIGNED', 'ACCEPTED_BY_PARTNER', 'PROCESSING', 'NEW', 'PENDING', 'PENDING_ASSIGNMENT'].includes(s)) res.CONFIRMED += 1;
      else if (s === 'CANCELLED') res.CANCELLED += 1;
    }
    return res;
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return orders.filter((order) => {
      const s = (order.status || '').toUpperCase();
      const orderDate = new Date(order.createdAt);

      // 1. Status Filter
      if (statusFilter === 'ON_THE_WAY' && s !== 'OUT_FOR_DELIVERY') return false;
      if (statusFilter === 'DELIVERED' && !['DELIVERED', 'COMPLETED'].includes(s)) return false;
      if (statusFilter === 'CONFIRMED' && !['CONFIRMED', 'ASSIGNED', 'ACCEPTED_BY_PARTNER', 'PROCESSING', 'NEW', 'PENDING', 'PENDING_ASSIGNMENT'].includes(s)) return false;
      if (statusFilter === 'CANCELLED' && s !== 'CANCELLED') return false;

      // 2. Time Filter
      if (timeFilter === 'LAST_30_DAYS' && orderDate < thirtyDaysAgo) return false;
      if (timeFilter === 'YEAR_2026' && orderDate.getFullYear() !== 2026) return false;
      if (timeFilter === 'OLDER' && orderDate.getFullYear() >= 2026) return false;

      // 3. Search Query
      if (q) {
        const orderIdStr = formatOrderId(order.id).toLowerCase();
        const rawId = (order.id || '').toLowerCase();
        const itemsStr = (order.items || [])
          .map((i: any) => `${i.product?.name || ''} ${i.quantity}`)
          .join(' ')
          .toLowerCase();

        if (
          !orderIdStr.includes(q) &&
          !rawId.includes(q) &&
          !itemsStr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, timeFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  const activeFiltersCount = (statusFilter !== 'ALL' ? 1 : 0) + (timeFilter !== 'ALL' ? 1 : 0) + (searchQuery ? 1 : 0);

  const clearAllFilters = () => {
    setStatusFilter('ALL');
    setTimeFilter('ALL');
    setSearchQuery('');
    setSearchInputText('');
    setCurrentPage(1);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(searchInputText);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased pb-20 sm:pb-12">
      <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        
        {/* ─── DESKTOP HEADER & BREADCRUMB ───────────────────────── */}
        <div className="hidden lg:flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0F172A]">My Orders</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {orders.length} Orders
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadOrders()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              to="/customer/shop"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Order Water</span>
            </Link>
          </div>
        </div>

        {/* ─── MOBILE TOP BAR & SEARCH ROW ────────────────────────── */}
        <div className="lg:hidden space-y-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0F172A]">My Orders</h1>
              <span className="text-xs font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                {orders.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadOrders()}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search + Mobile Filter Button */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInputText}
                onChange={(e) => setSearchInputText(e.target.value)}
                onBlur={() => setSearchQuery(searchInputText)}
                placeholder="Search your order here"
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/10 text-slate-800 placeholder:text-slate-400 shadow-2xs font-medium"
              />
              {searchInputText && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInputText('');
                    setSearchQuery('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border shadow-2xs transition cursor-pointer shrink-0 ${
                activeFiltersCount > 0
                  ? 'bg-[#1E88E5] text-white border-[#1E88E5]'
                  : 'bg-white text-slate-700 border-[#E2E8F0] hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-[#1E88E5] text-[10px] flex items-center justify-center font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Active filter badges on mobile */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1E88E5] border border-blue-100 font-semibold whitespace-nowrap">
                  <span>Status: {statusFilter.replace(/_/g, ' ')}</span>
                  <button onClick={() => setStatusFilter('ALL')} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {timeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1E88E5] border border-blue-100 font-semibold whitespace-nowrap">
                  <span>Time: {timeFilter.replace(/_/g, ' ')}</span>
                  <button onClick={() => setTimeFilter('ALL')} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1E88E5] border border-blue-100 font-semibold whitespace-nowrap">
                  <span>Query: "{searchQuery}"</span>
                  <button onClick={() => { setSearchQuery(''); setSearchInputText(''); }} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="text-slate-500 hover:text-slate-800 font-bold underline px-1 text-[10px] whitespace-nowrap"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ─── MAIN CONTENT: DESKTOP 2-COLUMN / MOBILE FULL WIDTH ── */}
        <div className="lg:grid lg:grid-cols-[240px_1fr] gap-6 items-start">
          
          {/* ─── DESKTOP LEFT FILTER PANEL ───────────────────────── */}
          <div className="hidden lg:block bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-5 shadow-2xs sticky top-20">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Filters</h2>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[11px] font-bold text-[#1E88E5] hover:underline cursor-pointer"
                >
                  CLEAR ALL
                </button>
              )}
            </div>

            {/* Status Filter Options */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Status
              </span>
              <div className="space-y-1.5 text-xs font-medium text-slate-700">
                {[
                  { key: 'ALL', label: 'All Orders', count: counts.ALL },
                  { key: 'ON_THE_WAY', label: 'On the way', count: counts.ON_THE_WAY },
                  { key: 'DELIVERED', label: 'Delivered', count: counts.DELIVERED },
                  { key: 'CONFIRMED', label: 'Confirmed & Placed', count: counts.CONFIRMED },
                  { key: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="desktop_status"
                        checked={statusFilter === item.key}
                        onChange={() => {
                          setStatusFilter(item.key as StatusFilterType);
                          setCurrentPage(1);
                        }}
                        className="w-3.5 h-3.5 text-[#1E88E5] focus:ring-[#1E88E5]"
                      />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{item.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Filter Options */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Time
              </span>
              <div className="space-y-1.5 text-xs font-medium text-slate-700">
                {[
                  { key: 'ALL', label: 'All Time' },
                  { key: 'LAST_30_DAYS', label: 'Last 30 days' },
                  { key: 'YEAR_2026', label: '2026' },
                  { key: 'OLDER', label: 'Older' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="desktop_time"
                      checked={timeFilter === item.key}
                      onChange={() => {
                        setTimeFilter(item.key as TimeFilterType);
                        setCurrentPage(1);
                      }}
                      className="w-3.5 h-3.5 text-[#1E88E5] focus:ring-[#1E88E5]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT / MAIN ORDER LIST FEED ────────────────────── */}
          <div className="space-y-3">
            
            {/* Desktop Top Search Bar */}
            <div className="hidden lg:block bg-white border border-[#E2E8F0] rounded-xl p-2 shadow-2xs">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchInputText}
                    onChange={(e) => setSearchInputText(e.target.value)}
                    placeholder="Search your orders here (Order ID, product, slot...)"
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/70 border border-[#E2E8F0] rounded-lg outline-none focus:bg-white focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5]/30 text-slate-800 placeholder:text-slate-400 font-medium"
                  />
                  {searchInputText && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInputText('');
                        setSearchQuery('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Orders</span>
                </button>
              </form>
            </div>

            {/* Order Items Listing Container */}
            {isLoading ? (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-2xs">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse space-y-3 p-4 border border-slate-100 rounded-xl">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-slate-200 rounded w-28" />
                      <div className="h-5 bg-slate-200 rounded-full w-20" />
                    </div>
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-10 bg-slate-50 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <DataErrorState
                title="Unable to load your orders"
                message={error?.message || 'Failed to fetch your order history. Please check your connection and try again.'}
                onRetry={() => loadOrders()}
              />
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-2xs">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Package className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No orders found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  {searchQuery || statusFilter !== 'ALL' || timeFilter !== 'ALL'
                    ? 'No orders match your filter selection. Try clearing filters or searching for another term.'
                    : 'You have not placed any orders yet. Click below to order fresh water delivered to your door.'}
                </p>
                {searchQuery || statusFilter !== 'ALL' || timeFilter !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="px-4 py-2 text-xs font-semibold text-[#1E88E5] bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <Link
                    to="/customer/shop"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-2xs transition"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Order Water</span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl divide-y divide-[#E2E8F0] overflow-hidden shadow-2xs">
                {paginatedOrders.map((order) => {
                  const canonicalId = formatOrderId(order.id);
                  const orderDate = new Date(order.createdAt);
                  const formattedDate = orderDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const itemsList = order.items || [];
                  const primaryItem = itemsList[0];
                  const totalItemsCount = itemsList.length;
                  const totalJarsCount = itemsList.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
                  
                  const primaryName = primaryItem?.product?.name || 'Edrops 20L Water Jar';
                  const otherItemsText = totalItemsCount > 1 ? ` + ${totalItemsCount - 1} other item${totalItemsCount > 2 ? 's' : ''}` : '';
                  const fullTitle = `${primaryName}${otherItemsText}`;

                  // Canonical product image resolution matching OrderDetails.tsx
                  const productImageUrl =
                    primaryItem?.product?.images?.[0]?.url ||
                    primaryItem?.product?.imageUrl ||
                    primaryItem?.images?.[0]?.url ||
                    null;

                  const pmt = formatPaymentDetails(order);
                  const statusKey = (order.status || '').toUpperCase();
                  const isDelivered = statusKey === 'DELIVERED' || statusKey === 'COMPLETED';
                  const isOutForDelivery = statusKey === 'OUT_FOR_DELIVERY';
                  const isCancelled = statusKey === 'CANCELLED';

                  // Status line rendering
                  let statusTitle = `Placed on ${formattedDate}`;
                  let statusColorClass = 'text-[#1E88E5]';
                  let statusDotClass = 'bg-[#1E88E5]';
                  let subtext = `Slot: ${formatDeliverySlot(order.timeSlot)}`;

                  if (isDelivered) {
                    statusTitle = `Delivered on ${formattedDate}`;
                    statusColorClass = 'text-emerald-700';
                    statusDotClass = 'bg-emerald-600';
                    subtext = 'Your water has been delivered';
                  } else if (isOutForDelivery) {
                    statusTitle = 'Out for Delivery';
                    statusColorClass = 'text-purple-700';
                    statusDotClass = 'bg-purple-600 animate-pulse';
                    subtext = 'Driver is on the way to your address';
                  } else if (statusKey === 'CONFIRMED' || statusKey === 'ASSIGNED' || statusKey === 'ACCEPTED_BY_PARTNER') {
                    statusTitle = `Confirmed on ${formattedDate}`;
                    statusColorClass = 'text-blue-700';
                    statusDotClass = 'bg-blue-600';
                    subtext = 'Order verified and scheduled for delivery';
                  } else if (isCancelled) {
                    statusTitle = 'Cancelled';
                    statusColorClass = 'text-rose-600';
                    statusDotClass = 'bg-rose-500';
                    subtext = 'Order was cancelled';
                  }

                  return (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/customer/orders/${order.id}`)}
                      className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors cursor-pointer group flex items-center justify-between gap-3 sm:gap-4"
                    >
                      {/* Left: Product Thumbnail & Order Info Cluster */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        
                        {/* Thumbnail Image */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex items-center justify-center shrink-0 relative group-hover:border-blue-300 transition-colors">
                          {productImageUrl ? (
                            <img
                              src={productImageUrl}
                              alt={primaryName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.order-img-fallback');
                                if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div
                            className={`order-img-fallback flex items-center justify-center text-[#94A3B8] ${
                              productImageUrl ? 'hidden' : 'flex'
                            }`}
                          >
                            <ShoppingBag className="w-6 h-6 text-[#94A3B8]" />
                          </div>
                          {totalItemsCount > 1 && (
                            <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-slate-900/80 text-white text-[9px] font-bold">
                              +{totalItemsCount - 1}
                            </span>
                          )}
                        </div>

                        {/* Middle Details */}
                        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                          
                          {/* Status Line (Compact color dot + status) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`flex items-center gap-1.5 text-xs font-bold ${statusColorClass}`}>
                              <span className={`w-2 h-2 rounded-full ${statusDotClass} shrink-0`} />
                              <span>{statusTitle}</span>
                            </span>
                          </div>

                          {/* Product Title */}
                          <h2 className="text-xs sm:text-sm font-bold text-[#0F172A] truncate leading-tight group-hover:text-[#1E88E5] transition-colors" title={fullTitle}>
                            {fullTitle}
                          </h2>

                          {/* Order ID & Meta */}
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                            <span className="font-mono font-bold text-slate-700">
                              Order {canonicalId}
                            </span>
                            <span>•</span>
                            <span>{formattedTime}</span>
                            <span>•</span>
                            <span>Qty: {totalJarsCount} {totalJarsCount === 1 ? 'jar' : 'jars'}</span>
                          </div>

                          {/* Payment state note (only when relevant) */}
                          {(pmt.status === 'Pending' || pmt.method.includes('COD')) && !isDelivered && !isCancelled && (
                            <div className="pt-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-1.5 py-0.2 rounded">
                                <span>{pmt.fullLabel}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Part: Price & Action */}
                      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                        {/* Price */}
                        <div className="text-right">
                          <span className="text-sm sm:text-base font-bold text-[#0F172A] block font-mono">
                            ₹{Number(order.totalAmount || 0).toFixed(2)}
                          </span>
                          <span className="hidden sm:block text-[10px] text-slate-400 font-medium">
                            {subtext}
                          </span>
                        </div>

                        {/* Action Group */}
                        <div className="flex items-center gap-1">
                          {/* Desktop 1-Click Invoice Download */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateOrderInvoice(order);
                            }}
                            title="Download Invoice"
                            className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-[#1E88E5] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Chevron Arrow */}
                          <div className="p-1 text-slate-300 group-hover:text-[#1E88E5] group-hover:translate-x-0.5 transition-all">
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── COMPACT PAGINATION FOOTER ─────────────────────── */}
            {filteredOrders.length > pageSize && (
              <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs text-slate-600 shadow-2xs">
                <span>
                  Showing <strong>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredOrders.length)}</strong> of <strong>{filteredOrders.length}</strong> orders
                </span>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-bold text-slate-800">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* ─── MOBILE FILTER BOTTOM SHEET MODAL ─────────────────────── */}
      {mobileFilterOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setMobileFilterOpen(false)}
          />

          <div className="relative bg-white rounded-t-3xl border-t border-[#E2E8F0] shadow-2xl p-5 space-y-5 max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom-5 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#1E88E5]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Filter Orders</h3>
              </div>
              <div className="flex items-center gap-3">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-[#1E88E5] hover:underline"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Filter Section */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Status
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                {[
                  { key: 'ALL', label: 'All Orders', count: counts.ALL },
                  { key: 'ON_THE_WAY', label: 'On the way', count: counts.ON_THE_WAY },
                  { key: 'DELIVERED', label: 'Delivered', count: counts.DELIVERED },
                  { key: 'CONFIRMED', label: 'Confirmed', count: counts.CONFIRMED },
                  { key: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(item.key as StatusFilterType);
                      setCurrentPage(1);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition ${
                      statusFilter === item.key
                        ? 'border-[#1E88E5] bg-blue-50/70 text-[#1E88E5]'
                        : 'border-[#E2E8F0] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] opacity-70">({item.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Filter Section */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Time
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                {[
                  { key: 'ALL', label: 'All Time' },
                  { key: 'LAST_30_DAYS', label: 'Last 30 days' },
                  { key: 'YEAR_2026', label: 'Year 2026' },
                  { key: 'OLDER', label: 'Older' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setTimeFilter(item.key as TimeFilterType);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left transition ${
                      timeFilter === item.key
                        ? 'border-[#1E88E5] bg-blue-50/70 text-[#1E88E5]'
                        : 'border-[#E2E8F0] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply Action Button */}
            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="w-full py-3 bg-[#1E88E5] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                Show {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


