import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Package,
  Search,
  X,
  RotateCw,
  Eye,
  ChevronRight,
  ChevronLeft,
  Phone,
  Truck,
  Building2,
  Layers,
  Repeat,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { AdminTopbar } from '../components/AdminTopbar';
import AdminOrderDetailModal from '../components/AdminOrderDetailModal';
import {
  formatOrderId,
  formatOrderStatus,
  getOrderStatusBadgeClass,
  formatPaymentDetails,
} from '../../../utils/orderFormatters';
import { useSocket } from '../../../contexts/SocketContext';

export default function OrdersDashboard() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // Search & Filter States
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected Order for Inspection Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Real-time WebSocket synchronization across portals
  useEffect(() => {
    if (!socket) return;
    const handleOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
    };

    socket.on('ORDER_STATUS_CHANGED', handleOrderEvent);
    socket.on('order:updated', handleOrderEvent);
    socket.on('order:assigned', handleOrderEvent);
    socket.on('order:claimed', handleOrderEvent);

    return () => {
      socket.off('ORDER_STATUS_CHANGED', handleOrderEvent);
      socket.off('order:updated', handleOrderEvent);
      socket.off('order:assigned', handleOrderEvent);
      socket.off('order:claimed', handleOrderEvent);
    };
  }, [socket, queryClient]);

  // Fetch real database orders from admin/staff endpoint
  const {
    data: apiResponse,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['adminOrders', page, limit, statusFilter, typeFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      return fetchWithAuth(`/order/admin/all?${params.toString()}`);
    },
    staleTime: 1000 * 15,
  });

  // Extract structured orders and pagination
  const orders: any[] = useMemo(() => {
    if (Array.isArray(apiResponse)) return apiResponse;
    if (Array.isArray(apiResponse?.data)) return apiResponse.data;
    return [];
  }, [apiResponse]);

  const pagination = useMemo(() => {
    if (apiResponse?.pagination) {
      return apiResponse.pagination;
    }
    return {
      total: orders.length,
      page,
      limit,
      totalPages: Math.ceil(orders.length / limit) || 1,
    };
  }, [apiResponse, orders.length, page, limit]);


  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch.length > 0 || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ─── 1. STANDARDIZED SHARED ADMIN TOPBAR ─────────────────────── */}
      <AdminTopbar
        title="Orders"
        subtitle="Manage marketplace, subscription and operational orders."
        icon={ShoppingBag}
        iconVariant="blue"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/orders/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#1262A5] text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>POS Entry</span>
            </Link>
            <Link
              to="/admin/orders/management"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Bulk Manage</span>
            </Link>
          </div>
        }
      />

      {/* ─── 2. SEARCH & FILTER TOOLBAR ───────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col gap-3">
          {/* Top Row: Search Input & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search by Order ID, customer, phone, distributor, driver..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl outline-none focus:bg-white focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F] placeholder:text-gray-400 font-medium"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh orders"
              className="p-2 sm:px-3 sm:py-2 bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#16324F] transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#1677C8]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Bottom Row: Status Filter Pills + Order Type Filter */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Status Filter Segment */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 overflow-x-auto">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'PENDING', label: 'New / Placed' },
                { key: 'ACTIVE', label: 'Active' },
                { key: 'DELIVERED', label: 'Delivered' },
                { key: 'CANCELLED', label: 'Cancelled' },
              ].map((sf) => (
                <button
                  key={sf.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(sf.key);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] whitespace-nowrap ${
                    statusFilter === sf.key
                      ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                      : 'text-[#64748B] hover:text-[#16324F]'
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>

            {/* Order Type Filter Segment */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              {[
                { key: 'ALL', label: 'All Types' },
                { key: 'ONETIME_ORDER', label: 'Marketplace' },
                { key: 'SUBSCRIPTION_ORDER', label: 'Subscription' },
              ].map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => {
                    setTypeFilter(tf.key);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] whitespace-nowrap ${
                    typeFilter === tf.key
                      ? 'bg-white text-[#1677C8] shadow-2xs font-bold'
                      : 'text-[#64748B] hover:text-[#16324F]'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Results Count Badge */}
            <span className="text-[11px] font-semibold text-[#64748B] ml-auto md:ml-2">
              Showing <span className="font-bold text-[#16324F]">{orders.length}</span> of{' '}
              <span className="font-bold text-[#16324F]">{pagination.total}</span> orders
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. DATA TABLE & LIST ─────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <LoadingSpinner size="md" label="Loading real orders from database..." />
          </div>
        ) : isError ? (
          <div className="p-6">
            <DataErrorState
              title="Unable to load orders"
              message={
                (error as any)?.message ||
                'Failed to fetch orders from the backend. Please check your connection and retry.'
              }
              onRetry={() => refetch()}
            />
          </div>
        ) : orders.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#1677C8] mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#16324F]">
              {hasActiveFilters ? 'No Matching Orders' : 'No Orders Found'}
            </h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              {hasActiveFilters
                ? 'No orders matched your current search and filter criteria. Try adjusting or clearing your filters.'
                : 'There are currently no orders in the system. Use POS Entry to place a new order.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 text-xs font-semibold text-[#1677C8] bg-blue-50 rounded-xl hover:bg-blue-100 transition cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <Link
                to="/admin/orders/new"
                className="inline-flex items-center gap-2 bg-[#1677C8] hover:bg-[#1362a4] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Create First Order</span>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50/70 text-[#64748B] uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">ORDER ID & DATE</th>
                    <th className="py-3 px-4">CUSTOMER</th>
                    <th className="py-3 px-4">TYPE</th>
                    <th className="py-3 px-4">ITEMS / QTY</th>
                    <th className="py-3 px-4">DISTRIBUTOR</th>
                    <th className="py-3 px-4">ASSIGNED DRIVER</th>
                    <th className="py-3 px-4">ORDER STATUS</th>
                    <th className="py-3 px-4">PAYMENT</th>
                    <th className="py-3 px-4 text-right">TOTAL</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order: any) => {
                    const cleanId = formatOrderId(order.id);
                    const rawStatus = order.status || 'NEW';
                    const statusBadge = getOrderStatusBadgeClass(rawStatus);
                    const statusLabel = formatOrderStatus(rawStatus);

                    const orderType = order.orderType || order.type || 'ONETIME_ORDER';
                    const isSubscription =
                      orderType === 'SUBSCRIPTION_ORDER' || orderType === 'SUBSCRIPTION';

                    const customerUser = order.customer?.user;
                    const customerName = customerUser
                      ? `${customerUser.firstName || ''} ${customerUser.lastName || ''}`.trim() || 'Valued Customer'
                      : 'Valued Customer';
                    const customerPhone = customerUser?.phone || order.customer?.phone || '—';
                    const company = order.customer?.companyName || null;

                    const distributor = order.distributor;
                    const distributorName = distributor
                      ? `${distributor.firstName || ''} ${distributor.lastName || ''}`.trim()
                      : null;

                    const driver = order.driver;
                    const partner = order.delivery?.assignment?.deliveryPartner?.user;
                    const driverName =
                      driver?.name ||
                      (partner ? `${partner.firstName || ''} ${partner.lastName || ''}`.trim() : null);

                    const items = Array.isArray(order.items) ? order.items : [];
                    const totalQty = items.reduce(
                      (acc: number, item: any) => acc + (item.quantity || 1),
                      0
                    );
                    const firstItemName = items[0]?.product?.name || (items.length > 0 ? 'Item' : '—');

                    const paymentDetails = formatPaymentDetails(order);
                    const totalAmount = Number(order.totalAmount || 0).toFixed(2);
                    const createdDate = order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';
                    const createdTime = order.createdAt
                      ? new Date(order.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Order ID & Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1677C8] transition-colors" />
                            <span className="font-bold text-[#16324F] font-mono group-hover:text-[#1677C8] transition-colors">
                              #{cleanId}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#64748B] mt-0.5 ml-5.5">
                            {createdDate} {createdTime && `· ${createdTime}`}
                          </p>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-bold text-[#16324F] truncate max-w-[150px]">
                            {customerName}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-[#64748B] mt-0.5">
                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                            <span className="font-mono">{customerPhone}</span>
                          </div>
                          {company && (
                            <span className="inline-block text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded mt-0.5 max-w-[140px] truncate">
                              {company}
                            </span>
                          )}
                        </td>

                        {/* Order Type */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                              isSubscription
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-[#1677C8] border-blue-200'
                            }`}
                          >
                            {isSubscription ? (
                              <Repeat className="w-2.5 h-2.5" />
                            ) : (
                              <Layers className="w-2.5 h-2.5" />
                            )}
                            <span>{isSubscription ? 'Subscription' : 'Marketplace'}</span>
                          </span>
                        </td>

                        {/* Products / Quantity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[#16324F] truncate max-w-[140px]" title={firstItemName}>
                            {firstItemName}
                            {items.length > 1 && (
                              <span className="text-[10px] text-[#64748B] font-normal ml-1">
                                +{items.length - 1} more
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#64748B] mt-0.5">
                            Qty: <span className="font-bold text-slate-700">{totalQty}</span>
                          </p>
                        </td>

                        {/* Distributor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {distributorName ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                                {distributorName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Assigned Driver */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {driverName ? (
                            <div className="flex items-center gap-1.5">
                              <Truck className="w-3 h-3 text-[#1677C8] shrink-0" />
                              <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                                {driverName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Order Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}
                          >
                            {statusLabel}
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${paymentDetails.badgeClass}`}
                          >
                            {paymentDetails.status}
                          </span>
                          <p className="text-[10px] text-[#64748B] mt-0.5 truncate max-w-[110px]">
                            {paymentDetails.method}
                          </p>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-bold text-[#16324F] text-xs">₹{totalAmount}</span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#1677C8] bg-blue-50/60 hover:bg-[#1677C8] hover:text-white transition-all cursor-pointer"
                            title="View full order details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack View (< 768px) */}
            <div className="md:hidden divide-y divide-gray-100">
              {orders.map((order: any) => {
                const cleanId = formatOrderId(order.id);
                const rawStatus = order.status || 'NEW';
                const statusBadge = getOrderStatusBadgeClass(rawStatus);
                const statusLabel = formatOrderStatus(rawStatus);

                const orderType = order.orderType || order.type || 'ONETIME_ORDER';
                const isSubscription =
                  orderType === 'SUBSCRIPTION_ORDER' || orderType === 'SUBSCRIPTION';

                const customerUser = order.customer?.user;
                const customerName = customerUser
                  ? `${customerUser.firstName || ''} ${customerUser.lastName || ''}`.trim() || 'Valued Customer'
                  : 'Valued Customer';
                const customerPhone = customerUser?.phone || order.customer?.phone || '—';

                const distributor = order.distributor;
                const distributorName = distributor
                  ? `${distributor.firstName || ''} ${distributor.lastName || ''}`.trim()
                  : null;

                const driver = order.driver;
                const partner = order.delivery?.assignment?.deliveryPartner?.user;
                const driverName =
                  driver?.name ||
                  (partner ? `${partner.firstName || ''} ${partner.lastName || ''}`.trim() : null);

                const items = Array.isArray(order.items) ? order.items : [];
                const totalQty = items.reduce(
                  (acc: number, item: any) => acc + (item.quantity || 1),
                  0
                );
                const firstItemName = items[0]?.product?.name || (items.length > 0 ? 'Item' : '—');

                const paymentDetails = formatPaymentDetails(order);
                const totalAmount = Number(order.totalAmount || 0).toFixed(2);
                const createdDate = order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : '—';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="p-3.5 hover:bg-slate-50 transition cursor-pointer space-y-2.5"
                  >
                    {/* Header: ID, Date & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#1677C8]" />
                        <span className="font-bold text-[#16324F] font-mono text-xs">
                          #{cleanId}
                        </span>
                        <span className="text-[10px] text-slate-400">· {createdDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            isSubscription
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1677C8] border-blue-200'
                          }`}
                        >
                          {isSubscription ? 'Sub' : 'Market'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusBadge}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Customer & Total */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#16324F] text-xs">{customerName}</p>
                        <p className="text-[10px] text-[#64748B] font-mono">{customerPhone}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#16324F] text-sm">₹{totalAmount}</span>
                        <div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${paymentDetails.badgeClass}`}
                          >
                            {paymentDetails.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Meta: Items, Distributor, Driver */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[180px] font-medium text-slate-700">
                          {firstItemName} ({totalQty} {totalQty === 1 ? 'item' : 'items'})
                        </span>
                        <div className="flex items-center gap-1 text-[#1677C8] font-bold">
                          <span>Details</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                      {(distributorName || driverName) && (
                        <div className="flex items-center gap-3 text-slate-500">
                          {distributorName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[120px]">{distributorName}</span>
                            </span>
                          )}
                          {driverName && (
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3 text-[#1677C8] shrink-0" />
                              <span className="truncate max-w-[120px]">{driverName}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 bg-slate-50/80 border-t border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs text-[#64748B]">
                  Page <span className="font-bold text-[#16324F]">{pagination.page}</span> of{' '}
                  <span className="font-bold text-[#16324F]">{pagination.totalPages}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 bg-white border border-[#E2E8F0] rounded-lg text-slate-600 hover:text-[#16324F] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="p-1.5 bg-white border border-[#E2E8F0] rounded-lg text-slate-600 hover:text-[#16324F] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── 4. ADMIN ORDER DETAIL INSPECTION MODAL ───────────────────── */}
      {selectedOrder && (
        <AdminOrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
