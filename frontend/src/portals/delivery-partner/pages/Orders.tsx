import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  MapPin,
  Plus,
  Eye,
  RotateCw,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import OrderFormModal from '../components/OrderFormModal';
import OrderDetailModal, {
  type OrderDetail,
  getOrderStatusConfig,
} from '../components/OrderDetailModal';

type TabFilter = 'ALL' | 'PENDING' | 'DELIVERED';

export default function Orders() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Load Orders from Backend
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[Orders] GET /order/partner/all');
      let data: any;
      try {
        data = await fetchWithAuth('/order/partner/all');
      } catch {
        console.log('[Orders] Fallback GET /order/staff/all');
        data = await fetchWithAuth('/order/staff/all');
      }

      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
            onClick={loadOrders}
            disabled={loading}
            title="Refresh Orders"
            className="p-2.5 text-[#64748B] hover:text-[#1677C8] hover:bg-blue-50 bg-white border border-[#E2E8F0] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 p-1 bg-white border border-[#E2E8F0] rounded-xl overflow-x-auto">
          <button
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

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search order #, customer, phone, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F] placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Orders List / Table */}
      {filteredOrders.length > 0 ? (
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
                        #{order.id.slice(-6).toUpperCase()}
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
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusConfig.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                          <span>{statusConfig.label}</span>
                        </span>
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
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <h3 className="text-sm font-bold text-[#16324F]">{customerName}</h3>
                      </div>
                      <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        <span className="line-clamp-1">{fullAddress || 'Address on file'}</span>
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                      <span>{statusConfig.label}</span>
                    </span>
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
    </div>
  );
}
