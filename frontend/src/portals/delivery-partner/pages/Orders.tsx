import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  MapPin,
  Plus,
  Eye,
  RotateCw,
  Filter,
  X,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { useSocket } from '../../../contexts/SocketContext';
import { toast } from 'react-hot-toast';
import OrderFormModal from '../components/OrderFormModal';
import OrderDetailModal, {
  type OrderDetail,
  getOrderStatusConfig,
} from '../components/OrderDetailModal';
import { formatOrderId, getPaymentStatusLabel } from '../../../utils/orderFormatters';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { DataErrorState } from '../../../components/common/DataErrorState';
import { useRegisterRefreshHandler } from '../../../components/pwa/PullToRefresh';

type TabFilter = 'ALL' | 'PENDING' | 'DELIVERED';

export default function Orders() {
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Load Orders from Backend
  const fetchOrders = useCallback(async (): Promise<OrderDetail[]> => {
    console.log('[Orders] GET /order/partner/all');
    let data: any;
    try {
      data = await fetchWithAuth('/order/partner/all');
    } catch {
      console.log('[Orders] Fallback GET /order/staff/all');
      data = await fetchWithAuth('/order/staff/all');
    }

    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  }, []);

  const {
    data: ordersData,
    error,
    isLoading,
    isError,
    reload: loadOrders,
  } = useDataFetch<OrderDetail[]>(fetchOrders);

  const orders = useMemo(() => ordersData || [], [ordersData]);

  useRegisterRefreshHandler(loadOrders);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    if (!socket) return;

    const handleOrderAssigned = (data: any) => {
      const orderShortId = data?.id ? formatOrderId(data.id) : '';
      toast.success(`New order assigned${orderShortId ? ` (${orderShortId})` : ''}!`, { icon: '🛵' });
      loadOrders(true);
    };

    const handleOrderUpdated = () => {
      loadOrders(true);
    };

    const handleStatusChanged = () => {
      loadOrders(true);
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

  // Tab & Search Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Tab Filter
      const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
      const isPending = !isDelivered;

      if (activeTab === 'PENDING' && !isPending) return false;
      if (activeTab === 'DELIVERED' && !isDelivered) return false;

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const orderNum = order.id.toLowerCase();
        const customerName = `${order.customer?.user?.firstName || ''} ${order.customer?.user?.lastName || ''}`.toLowerCase();
        const phone = (order.customer?.user?.phone || '').toLowerCase();
        const company = (order.customer?.companyName || '').toLowerCase();
        const address = [
          order.address?.houseName,
          order.address?.buildingName,
          order.address?.street,
          order.address?.city,
          order.address?.district,
          order.address?.zipCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const items = order.items?.map((i) => i.product?.name || '').join(' ').toLowerCase() || '';

        return (
          orderNum.includes(q) ||
          customerName.includes(q) ||
          phone.includes(q) ||
          company.includes(q) ||
          address.includes(q) ||
          items.includes(q)
        );
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Filter Counts
  const counts = useMemo(() => {
    let pending = 0;
    let delivered = 0;

    orders.forEach((o) => {
      if (o.status === 'DELIVERED' || o.status === 'COMPLETED') delivered++;
      else pending++;
    });

    return { all: orders.length, pending, delivered };
  }, [orders]);

  const handleOpenDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setSelectedOrderId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & + Create Order Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#16324F]">Orders Management</h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Create and manage delivery orders for your routes and customers
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadOrders()}
            disabled={isLoading}
            title="Refresh Orders"
            className="p-2.5 text-[#64748B] hover:text-[#1677C8] hover:bg-blue-50 bg-white border border-[#E2E8F0] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-[#1677C8] hover:bg-[#1362a4] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Order</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Desktop Status Tabs (visible on md: screens and up) */}
        <div className="hidden md:flex items-center gap-1 sm:gap-2 p-1 bg-white border border-[#E2E8F0] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-[#1677C8] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#16324F] hover:bg-gray-50'
            }`}
          >
            <span>All Orders</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#64748B]'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'PENDING'
                ? 'bg-[#1677C8] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#16324F] hover:bg-gray-50'
            }`}
          >
            <span>Pending / In Route</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'PENDING' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#64748B]'
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DELIVERED')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'DELIVERED'
                ? 'bg-[#1677C8] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#16324F] hover:bg-gray-50'
            }`}
          >
            <span>Delivered</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'DELIVERED' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#64748B]'
              }`}
            >
              {counts.delivered}
            </span>
          </button>
        </div>

        {/* Search Input + Mobile Filter Button Row */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search order #, customer, phone, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F] placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Button (md:hidden) */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className={`md:hidden inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl border shadow-2xs transition cursor-pointer shrink-0 ${
              activeTab !== 'ALL'
                ? 'bg-[#1677C8] text-white border-[#1677C8]'
                : 'bg-white text-slate-700 border-[#E2E8F0] hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{activeTab === 'ALL' ? 'Filter' : activeTab === 'PENDING' ? 'Pending' : 'Delivered'}</span>
            {activeTab !== 'ALL' ? (
              <span className="w-4 h-4 rounded-full bg-white text-[#1677C8] text-[10px] flex items-center justify-center font-black">
                {activeTab === 'PENDING' ? counts.pending : counts.delivered}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Active Filter Chips on Mobile */}
      {(activeTab !== 'ALL' || searchQuery) && (
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
          {activeTab !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1677C8] border border-blue-100 font-semibold whitespace-nowrap">
              <span>Status: {activeTab === 'PENDING' ? 'Pending / In Route' : 'Delivered'}</span>
              <button type="button" onClick={() => setActiveTab('ALL')} className="hover:opacity-75 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1677C8] border border-blue-100 font-semibold whitespace-nowrap">
              <span>Query: "{searchQuery}"</span>
              <button type="button" onClick={() => setSearchQuery('')} className="hover:opacity-75 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => { setActiveTab('ALL'); setSearchQuery(''); }}
            className="text-slate-500 hover:text-slate-800 font-bold underline px-1 text-[10px] whitespace-nowrap cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Orders List / Table */}
      {isLoading ? (
        <div className="space-y-3">
          {/* Desktop Table Skeleton */}
          <div className="hidden md:block bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50/80 border-b border-gray-200 flex items-center justify-between">
              <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse" />
              <div className="h-4 bg-slate-200 rounded w-20 animate-pulse" />
            </div>
            <div className="divide-y divide-gray-100 p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 animate-pulse py-2">
                  <div className="h-4 bg-slate-200 rounded w-20" />
                  <div className="h-4 bg-slate-200 rounded w-32" />
                  <div className="h-4 bg-slate-100 rounded w-40" />
                  <div className="h-4 bg-slate-100 rounded w-28" />
                  <div className="h-4 bg-slate-200 rounded w-16" />
                  <div className="h-6 bg-slate-200 rounded-full w-20" />
                  <div className="h-4 bg-slate-100 rounded w-24" />
                </div>
              ))}
            </div>
          </div>
          {/* Mobile Cards Skeleton */}
          <div className="md:hidden space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="h-4 bg-slate-200 rounded w-24" />
                  <div className="h-5 bg-slate-200 rounded-full w-16" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-3/4" />
                <div className="h-10 bg-slate-50 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <DataErrorState
          title="Unable to load orders"
          message={error?.message || 'Failed to fetch delivery orders. Please check your connection and try again.'}
          onRetry={() => loadOrders()}
        />
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-gray-200 text-[#64748B] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Order</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Delivery Location</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created By</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const customerName =
                    `${order.customer?.user?.firstName || ''} ${order.customer?.user?.lastName || ''}`.trim() ||
                    order.customer?.companyName ||
                    'Customer';

                  const statusConfig = getOrderStatusConfig(order.status);

                  const itemsSummary =
                    order.items
                      ?.map((i) => `${i.product?.name || 'Item'} × ${i.quantity}`)
                      .join(', ') || 'Standard Order';

                  const locationSummary =
                    [order.address?.city, order.address?.district].filter(Boolean).join(', ') ||
                    order.address?.street ||
                    'On file';

                  const firstHistory =
                    order.history && order.history.length > 0 ? order.history[0] : null;
                  const creatorName = firstHistory?.user
                    ? `${firstHistory.user.firstName} ${firstHistory.user.lastName}`.trim()
                    : 'Delivery Partner';

                  return (
                    <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Order ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#16324F]">
                        {formatOrderId(order.id)}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#16324F]">{customerName}</p>
                        <p className="text-[11px] text-[#64748B]">
                          {order.customer?.user?.phone || 'No phone'}
                        </p>
                      </td>

                      {/* Items */}
                      <td
                        className="py-3.5 px-4 max-w-xs truncate text-[#16324F] font-medium"
                        title={itemsSummary}
                      >
                        {itemsSummary}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[#16324F]">
                          <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                          <span className="truncate max-w-[160px]" title={locationSummary}>
                            {locationSummary}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-bold text-[#16324F]">
                        ₹{Number(order.totalAmount || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusConfig.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                            <span>{statusConfig.label}</span>
                          </span>
                          {(() => {
                            const pmt = getPaymentStatusLabel(order);
                            return (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${pmt.badgeClass}`}
                              >
                                {pmt.label}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Created By */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#16324F]">{creatorName}</p>
                        <span className="text-[10px] text-[#64748B]">Delivery Partner</span>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-[#64748B] text-[11px] whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(order.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:border-[#1677C8] hover:text-[#1677C8] text-[#16324F] font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (<768px) */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => {
              const customerName =
                `${order.customer?.user?.firstName || ''} ${order.customer?.user?.lastName || ''}`.trim() ||
                order.customer?.companyName ||
                'Customer';

              const statusConfig = getOrderStatusConfig(order.status);

              const fullAddress = [
                order.address?.houseName,
                order.address?.buildingName,
                order.address?.street,
                order.address?.city,
                order.address?.district,
                order.address?.zipCode,
              ]
                .filter(Boolean)
                .join(', ');

              const itemsSummary =
                order.items
                  ?.map((i) => `${i.product?.name || 'Item'} × ${i.quantity}`)
                  .join(', ') || 'Standard Order';

              return (
                <div
                  key={order.id}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-2xs hover:border-blue-200 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#64748B]">
                          {formatOrderId(order.id)}
                        </span>
                        <h3 className="text-sm font-bold text-[#16324F]">{customerName}</h3>
                      </div>
                      <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        <span className="line-clamp-1">{fullAddress || 'Address on file'}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                        <span>{statusConfig.label}</span>
                      </span>
                      {(() => {
                        const pmt = getPaymentStatusLabel(order);
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold ${pmt.badgeClass}`}
                          >
                            {pmt.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                    <p className="text-[#16324F] font-semibold">{itemsSummary}</p>
                    <div className="flex justify-between items-center text-[11px] text-[#64748B]">
                      <span>
                        Amount:{' '}
                        <strong className="text-[#16324F]">
                          ₹{Number(order.totalAmount || 0).toFixed(2)}
                        </strong>
                      </span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      onClick={() => handleOpenDetail(order.id)}
                      className="px-3 py-1.5 bg-[#1677C8] text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#1677C8] mb-3">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#16324F] mb-1">
            {searchQuery ? 'No matching orders found' : 'No orders registered yet'}
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? `No delivery orders matched "${searchQuery}". Clear your search query.`
              : 'Create manual customer orders for daily bottle deliveries or water jar dispatches.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-xs font-semibold text-[#1677C8] bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create First Order</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      <OrderFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          loadOrders();
        }}
      />

      {/* Order Details Modal (Always fetches fresh DB record by ID) */}
      <OrderDetailModal
        orderId={selectedOrderId}
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        onStatusUpdated={() => {
          loadOrders();
        }}
      />

      {/* ─── MOBILE FILTER BOTTOM SHEET MODAL ─────────────────────── */}
      {mobileFilterOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setMobileFilterOpen(false)}
          />

          <div className="relative bg-white rounded-t-3xl border-t border-[#E2E8F0] shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom-5 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#1677C8]" />
                <h3 className="text-sm font-bold text-[#16324F]">Filter Orders</h3>
              </div>
              <div className="flex items-center gap-3">
                {activeTab !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ALL');
                    }}
                    className="text-xs font-bold text-[#1677C8] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Filter Options */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Status
              </span>
              <div className="space-y-2 text-xs font-semibold">
                {[
                  { key: 'ALL', label: 'All Orders', count: counts.all },
                  { key: 'PENDING', label: 'Pending / In Route', count: counts.pending },
                  { key: 'DELIVERED', label: 'Delivered', count: counts.delivered },
                ].map((item) => {
                  const isSelected = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key as TabFilter);
                        setMobileFilterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-[#1677C8] bg-blue-50/80 text-[#1677C8]'
                          : 'border-[#E2E8F0] bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold">{item.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isSelected ? 'bg-[#1677C8] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Apply Action Button */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#1677C8] hover:bg-[#1362a4] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
