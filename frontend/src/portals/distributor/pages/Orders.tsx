import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  CreditCard,
  Ban,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  User,
  Phone,
  MapPin,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { formatOrderId, formatOrderStatus, getOrderPaymentState } from '../../../utils/orderFormatters';
import { getOrderStatusConfig } from '../../../utils/orderStateMachine';
import { useSocket } from '../../../contexts/SocketContext';

// Types
export interface OrderItemProduct {
  id: string;
  name: string;
  price: number;
  isJar?: boolean;
}

export interface OrderItemRecord {
  id: string;
  productId: string;
  product?: OrderItemProduct;
  quantity: number;
  unitPrice: number;
  deposit: number;
  total: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  receiptId?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface OrderStatusHistoryRecord {
  id: string;
  previousStatus: string;
  newStatus: string;
  reason?: string | null;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: string;
  } | null;
}

export interface CustomerRecord {
  id: string;
  user?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };
  companyName?: string | null;
  referralCode?: string | null;
  addresses?: Array<{
    id: string;
    street: string;
    city: string;
    district?: string;
    state?: string;
    zipCode?: string;
    isDefault?: boolean;
  }>;
}

export interface DistributorOrder {
  id: string;
  customerId: string;
  customer?: CustomerRecord;
  orderType: string;
  orderSource: string;
  status: string;
  subTotal: number;
  depositTotal: number;
  deliveryCharge: number;
  discountTotal: number;
  totalAmount: number;
  totalQuantity?: number;
  amountPaid?: number;
  amountDue?: number;
  deliveryAddressId?: string;
  address?: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
    label?: string;
  };
  scheduledDate?: string | null;
  deliveredAt?: string | null;
  paymentStatus: string;
  paymentMethod?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemRecord[];
  payments: PaymentRecord[];
  history?: OrderStatusHistoryRecord[];
}

export interface OrderStats {
  totalOrders: number;
  pendingCount: number;
  confirmedCount: number;
  outForDeliveryCount: number;
  deliveredCount: number;
  cancelledCount: number;
  pendingPaymentCount: number;
  totalRevenue: number;
  totalCollected: number;
  totalDue: number;
}

interface FormLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

export default function Orders() {
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingCount: 0,
    confirmedCount: 0,
    outForDeliveryCount: 0,
    deliveredCount: 0,
    cancelledCount: 0,
    pendingPaymentCount: 0,
    totalRevenue: 0,
    totalCollected: 0,
    totalDue: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Catalog products and customers for selectors
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<CustomerRecord[]>([]);

  // Filters, search & pagination
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalMatching, setTotalMatching] = useState<number>(0);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<DistributorOrder | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  const [statusModalOrder, setStatusModalOrder] = useState<DistributorOrder | null>(null);
  const [newTargetStatus, setNewTargetStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  // Delivery payment fields (shown when DELIVERED is selected)
  const [deliveryPaymentMode, setDeliveryPaymentMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [deliveryPaymentAmount, setDeliveryPaymentAmount] = useState<string>('');
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState<string>('CASH');

  const [paymentModalOrder, setPaymentModalOrder] = useState<DistributorOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  const [cancelModalOrder, setCancelModalOrder] = useState<DistributorOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const [deleteModalOrder, setDeleteModalOrder] = useState<DistributorOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Create Order Form State
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formDeliveryAddressId, setFormDeliveryAddressId] = useState<string>('');
  const [formScheduledDate, setFormScheduledDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [formItems, setFormItems] = useState<FormLineItem[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, total: 0 },
  ]);
  const [formDeliveryCharge, setFormDeliveryCharge] = useState<string>('0');
  const [formOverallDiscount, setFormOverallDiscount] = useState<string>('0');
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>('CASH');
  const [formInitialPaymentAmount, setFormInitialPaymentAmount] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('');
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);

  // Load orders
  const loadOrders = async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (paymentStatusFilter !== 'ALL') params.append('paymentStatus', paymentStatusFilter);
      if (datePreset !== 'ALL') params.append('datePreset', datePreset);
      if (customerFilter !== 'ALL') params.append('customerId', customerFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const res = await fetchWithAuth(`/orders/distributor/all?${params.toString()}`);
      if (res && res.data) {
        setOrders(res.data);
        setTotalMatching(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        if (res.stats) setStats(res.stats);
      }
    } catch (err: any) {
      setIsError(true);
      setErrorMessage(err.message || 'Failed to load distributor orders');
      toast.error(err.message || 'Error loading orders');
    } finally {
      setIsLoading(false);
    }
  };

  // Load auxiliary data: Products and Customers
  const loadAuxiliaryData = async () => {
    try {
      const [productsData, customersData] = await Promise.all([
        fetchWithAuth('/catalog/products').catch(() => []),
        fetchWithAuth('/customer').catch(() => []),
      ]);

      if (Array.isArray(productsData)) {
        setCatalogProducts(productsData);
      }
      if (Array.isArray(customersData)) {
        setCustomersList(customersData);
      }
    } catch {
      // ignore
    }
  };

  const { socket } = useSocket();

  // Listen to WebSocket real-time events to auto-refresh assigned orders (ZERO POLLING)
  useEffect(() => {
    if (!socket) return;

    const handleAssigned = (payload: any) => {
      loadOrders();
      toast.success(
        payload?.order?.id
          ? `Order #${formatOrderId(payload.order.id)} assigned to you!`
          : 'New order assigned to you!',
      );
    };

    const handleStatusChanged = () => {
      loadOrders();
    };

    socket.on('ORDER_ASSIGNED_TO_YOU', handleAssigned);
    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);

    return () => {
      socket.off('ORDER_ASSIGNED_TO_YOU', handleAssigned);
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
    };
  }, [socket]);

  useEffect(() => {
    loadAuxiliaryData();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [page, limit, statusFilter, paymentStatusFilter, datePreset, customerFilter, sortBy, sortOrder]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadOrders();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Full Details
  const handleOpenDetails = async (order: DistributorOrder) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
    try {
      setIsLoadingDetails(true);
      const full = await fetchWithAuth(`/orders/distributor/${order.id}`);
      if (full) setSelectedOrder(full);
    } catch {
      // keep existing
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Create Order Line Items Calculation
  const formCalculations = useMemo(() => {
    let subtotal = 0;
    let itemsDiscount = 0;
    let taxTotal = 0;

    formItems.forEach((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      const disc = Math.max(0, Number(item.discount) || 0);
      const taxRate = Math.max(0, Number(item.taxRate) || 0);

      const lineGross = qty * price;
      const lineAfterDiscount = Math.max(0, lineGross - disc);
      const lineTax = lineAfterDiscount * (taxRate / 100);

      subtotal += lineGross;
      itemsDiscount += disc;
      taxTotal += lineTax;
    });

    const delivery = Math.max(0, Number(formDeliveryCharge) || 0);
    const overallDisc = Math.max(0, Number(formOverallDiscount) || 0);
    const totalDiscount = itemsDiscount + overallDisc;
    const grandTotal = Math.max(0, subtotal - totalDiscount + taxTotal + delivery);

    return {
      subtotal,
      totalDiscount,
      taxTotal,
      deliveryCharge: delivery,
      grandTotal,
    };
  }, [formItems, formDeliveryCharge, formOverallDiscount]);

  // Handle Item row updates
  const handleItemChange = (index: number, field: keyof FormLineItem, value: any) => {
    setFormItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'productId') {
        const prod = catalogProducts.find((p) => p.id === value);
        if (prod) {
          item.productName = prod.name;
          item.unitPrice = Number(prod.price) || 0;
        }
      }

      const qty = Math.max(1, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.unitPrice) || 0);
      const disc = Math.max(0, Number(item.discount) || 0);
      const taxRate = Math.max(0, Number(item.taxRate) || 0);
      const discounted = Math.max(0, qty * rate - disc);
      item.total = Number((discounted + discounted * (taxRate / 100)).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  const addItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, total: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) {
      toast.error('Order must have at least one line item');
      return;
    }
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenCreateModal = () => {
    setFormCustomerId('');
    setFormDeliveryAddressId('');
    setFormScheduledDate(new Date().toISOString().split('T')[0]);
    setFormItems([
      { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, total: 0 },
    ]);
    setFormDeliveryCharge('0');
    setFormOverallDiscount('0');
    setFormPaymentMethod('CASH');
    setFormInitialPaymentAmount('0');
    setFormNotes('');
    setIsCreateModalOpen(true);
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    const invalidItems = formItems.some((i) => !i.productId || Number(i.quantity) <= 0);
    if (invalidItems) {
      toast.error('Please select a valid product and quantity for each item');
      return;
    }

    try {
      setIsCreatingOrder(true);
      const payload = {
        customerId: formCustomerId,
        deliveryAddressId: formDeliveryAddressId || undefined,
        scheduledDate: formScheduledDate,
        items: formItems.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount || 0),
          taxRate: Number(i.taxRate || 0),
        })),
        deliveryCharge: Number(formDeliveryCharge || 0),
        discountTotal: Number(formOverallDiscount || 0),
        paymentMethod: formPaymentMethod,
        amountPaid: Number(formInitialPaymentAmount || 0),
        notes: formNotes.trim() || undefined,
      };

      const res = await fetchWithAuth('/orders/distributor', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Order created successfully!');
      setIsCreateModalOpen(false);
      loadOrders();
      if (res?.id) handleOpenDetails(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create order');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Status transitions mapping for modal (strictly linear 4-stage lifecycle)
  const getAllowedStatusTransitions = (currentStatus: string): string[] => {
    switch (currentStatus?.toUpperCase()) {
      case 'ORDER_PLACED':
      case 'PLACED':
      case 'NEW':
      case 'PENDING':
      case 'PENDING_ASSIGNMENT':
      case 'PENDING_PAYMENT':
        return ['CONFIRMED'];
      case 'CONFIRMED':
      case 'ASSIGNED':
      case 'ACCEPTED_BY_PARTNER':
        return ['OUT_FOR_DELIVERY'];
      case 'OUT_FOR_DELIVERY':
        return ['DELIVERED'];
      case 'DELIVERED':
      case 'COMPLETED':
      default:
        return []; // Finalized - no further status update
    }
  };

  const handleOpenStatusModal = (order: DistributorOrder) => {
    setStatusModalOrder(order);
    const allowed = getAllowedStatusTransitions(order.status);
    setNewTargetStatus(allowed[0] || '');
    setStatusReason('');
    setDeliveryPaymentMode('FULL');
    setDeliveryPaymentAmount('');
    setDeliveryPaymentMethod('CASH');
  };

  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalOrder || !newTargetStatus) return;

    const isDelivering = newTargetStatus === 'DELIVERED' || newTargetStatus === 'COMPLETED';

    // Validate partial payment amount if needed
    if (isDelivering && deliveryPaymentMode === 'PARTIAL') {
      const amt = Number(deliveryPaymentAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Please enter a valid partial payment amount greater than 0.');
        return;
      }
      const pst = getOrderPaymentState(statusModalOrder);
      if (amt > pst.due + 0.01) {
        toast.error(`Amount (₹${amt}) cannot exceed remaining due (₹${pst.due.toFixed(2)}).`);
        return;
      }
    }

    try {
      setIsUpdatingStatus(true);

      const body: any = {
        status: newTargetStatus,
        reason: statusReason.trim() || undefined,
      };

      if (isDelivering) {
        body.paymentInfo = {
          paymentMode: deliveryPaymentMode,
          paymentMethod: deliveryPaymentMethod,
          ...(deliveryPaymentMode === 'PARTIAL'
            ? { amountPaid: Number(deliveryPaymentAmount) }
            : {}),
        };
      }

      await fetchWithAuth(`/orders/distributor/${statusModalOrder.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      toast.success(`Order updated to ${newTargetStatus}`);
      setStatusModalOrder(null);
      loadOrders();
      if (selectedOrder && selectedOrder.id === statusModalOrder.id) {
        handleOpenDetails({ ...selectedOrder, status: newTargetStatus });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };


  // Payment Recording
  const handleOpenPaymentModal = (order: DistributorOrder) => {
    setPaymentModalOrder(order);
    const due = order.amountDue !== undefined ? order.amountDue : order.totalAmount;
    setPaymentAmount(String(due));
    setPaymentMethod(order.paymentMethod || 'CASH');
    setPaymentRefNumber('');
    setPaymentNotes('');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const idempotencyKey = `COLLECT-DIST-${paymentModalOrder.id}-${Date.now()}`;
      await fetchWithAuth(`/orders/distributor/${paymentModalOrder.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          paymentMethod,
          referenceNumber: paymentRefNumber.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
          idempotencyKey,
        }),
      });

      toast.success(`Payment of ₹${amt} collected successfully!`);
      setPaymentModalOrder(null);
      loadOrders();
      if (selectedOrder && selectedOrder.id === paymentModalOrder.id) {
        handleOpenDetails(selectedOrder);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to collect payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Cancel Order
  const handleOpenCancelModal = (order: DistributorOrder) => {
    setCancelModalOrder(order);
    setCancelReason('');
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    try {
      setIsCancelling(true);
      await fetchWithAuth(`/orders/distributor/${cancelModalOrder.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      toast.success('Order cancelled successfully');
      setCancelModalOrder(null);
      loadOrders();
      if (selectedOrder && selectedOrder.id === cancelModalOrder.id) {
        handleOpenDetails({ ...selectedOrder, status: 'CANCELLED' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  // Delete Order (Only for draft / unfinalized orders)
  const handleDeleteSubmit = async () => {
    if (!deleteModalOrder) return;
    try {
      setIsDeleting(true);
      await fetchWithAuth(`/orders/distributor/${deleteModalOrder.id}`, {
        method: 'DELETE',
      });
      toast.success('Order deleted');
      setDeleteModalOrder(null);
      if (selectedOrder?.id === deleteModalOrder.id) {
        setIsDetailsModalOpen(false);
        setSelectedOrder(null);
      }
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete order');
    } finally {
      setIsDeleting(false);
    }
  };

  // Status Badge styling helper using canonical 4-status configuration
  const getStatusBadge = (status: string) => {
    const config = getOrderStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${config.badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {config.label}
      </span>
    );
  };

  // Payment Status badge helper
  const getPaymentStatusBadge = (paymentStatus: string, dueAmount?: number) => {
    switch (paymentStatus) {
      case 'PAID':
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            PAID
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            PARTIAL
            {dueAmount && dueAmount > 0 ? ` (₹${dueAmount} due)` : ''}
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            REFUNDED
          </span>
        );
      case 'UNPAID':
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            UNPAID
          </span>
        );
    }
  };

  // Selected Customer in Form
  const formSelectedCustomer = useMemo(() => {
    return customersList.find((c) => c.id === formCustomerId);
  }, [customersList, formCustomerId]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full overflow-x-hidden">
      {/* ─── 1. PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-[#1677C8]" />
            Orders
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Manage distributor customer orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-[#1677C8] hover:bg-[#1264A8] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* ─── 2. COMPACT SUMMARY BAR (REAL BACKEND DATA) ─────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Orders</span>
          <span className="text-lg font-black text-slate-800">{stats.totalOrders}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">Pending</span>
          <span className="text-lg font-black text-sky-700">{stats.pendingCount}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Confirmed</span>
          <span className="text-lg font-black text-blue-700">{stats.confirmedCount}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">Out for Delivery</span>
          <span className="text-lg font-black text-purple-700">{stats.outForDeliveryCount}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Delivered</span>
          <span className="text-lg font-black text-emerald-700">{stats.deliveredCount}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Cancelled</span>
          <span className="text-lg font-black text-rose-700">{stats.cancelledCount}</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Pending Due</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-amber-700">₹{stats.totalDue.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-bold">({stats.pendingPaymentCount})</span>
          </div>
        </div>
      </div>

      {/* ─── 3. OPERATIONAL TOOLBAR (SEARCH + FILTERS) ──────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order number, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Order Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ORDER_PLACED">Order Placed</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>

        {/* Payment Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Payment:</span>
          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
          >
            <option value="ALL">All Payments</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>

        {/* Date Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Date:</span>
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
          </select>
        </div>

        {/* Customer Filter */}
        {customersList.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Customer:</span>
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8] max-w-[140px] truncate"
            >
              <option value="ALL">All Customers</option>
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user?.firstName} {c.user?.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Clear Filters button */}
        {(statusFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || datePreset !== 'ALL' || customerFilter !== 'ALL' || search) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPaymentStatusFilter('ALL');
              setDatePreset('ALL');
              setCustomerFilter('ALL');
              setSearch('');
              setPage(1);
            }}
            className="text-xs font-bold text-[#1677C8] hover:underline px-2 py-1 cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ─── 4. DENSE OPERATIONAL ORDER TABLE ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 select-none">
                <th className="py-3 px-3">Order No.</th>
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:text-slate-800 transition-colors"
                  onClick={() => handleSort('orderDate')}
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:text-slate-800 transition-colors"
                  onClick={() => handleSort('customer')}
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3">Items</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th
                  className="py-3 px-3 text-right cursor-pointer select-none hover:text-slate-800 transition-colors"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3">Payment</th>
                <th
                  className="py-3 px-3 cursor-pointer select-none hover:text-slate-800 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    <span>Order Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3">Delivery Date</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse h-12">
                    <td className="p-3"><div className="h-4 w-20 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-28 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-8 bg-slate-200 rounded-sm mx-auto" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-sm ml-auto" /></td>
                    <td className="p-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="p-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-slate-200 rounded-sm" /></td>
                    <td className="p-3"><div className="h-4 w-14 bg-slate-200 rounded-sm ml-auto" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                      <p className="font-bold text-slate-800 text-sm">Failed to load orders</p>
                      <p className="text-xs text-slate-500 mt-1">{errorMessage}</p>
                      <button
                        onClick={loadOrders}
                        className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#1677C8] flex items-center justify-center mb-3">
                        <Package className="w-6 h-6" />
                      </div>
                      <p className="font-black text-slate-800 text-base">No orders found</p>
                      <p className="text-xs font-medium text-slate-500 mt-1 mb-4 text-center">
                        {statusFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || search
                          ? 'No orders match the selected filters. Try clearing your filters.'
                          : 'Create your first customer order to get started.'}
                      </p>
                      {statusFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || search ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('ALL');
                            setPaymentStatusFilter('ALL');
                            setDatePreset('ALL');
                            setCustomerFilter('ALL');
                            setSearch('');
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenCreateModal}
                          className="bg-[#1677C8] hover:bg-[#1264A8] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ New Order</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const customerName = `${order.customer?.user?.firstName || 'Customer'} ${order.customer?.user?.lastName || ''}`.trim();
                  const customerPhone = order.customer?.user?.phone;
                  const formattedId = `#ORD-${formatOrderId(order.id)}`;
                  const isDeliveredOrFinalized = order.status === 'DELIVERED' || order.status === 'COMPLETED';
                  const isCancelled = order.status === 'CANCELLED';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/70 transition-colors h-12"
                    >
                      {/* Order Number */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(order)}
                          className="font-black text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
                          title="View order details"
                        >
                          {formattedId}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-semibold">
                        {new Date(order.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Customer */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 leading-tight truncate max-w-[160px]">
                          {customerName}
                        </div>
                        {customerPhone && (
                          <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[160px]">
                            {customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Items Preview */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-semibold">
                        <span title={order.items?.map((i) => `${i.product?.name || 'Product'} (x${i.quantity})`).join(', ')}>
                          {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
                        </span>
                      </td>

                      {/* Total Quantity */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center font-bold text-slate-700">
                        {order.totalQuantity || order.items?.reduce((s, i) => s + i.quantity, 0) || 0}
                      </td>

                      {/* Total Amount + Paid/Due breakdown */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        {(() => {
                          const pst = getOrderPaymentState(order);
                          return (
                            <div>
                              <div className="font-black text-slate-800">₹{pst.total.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
                              {pst.paid > 0 && (
                                <div className="text-[10px] text-emerald-700 font-semibold">Paid ₹{pst.paid.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
                              )}
                              {pst.hasDue && (
                                <div className="text-[10px] text-orange-600 font-bold">Due ₹{pst.due.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Payment Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {(() => {
                          const pst = getOrderPaymentState(order);
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pst.badgeClass}`}>
                              {pst.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Order Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>

                      {/* Delivery Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-semibold text-[11px]">
                        {order.deliveredAt
                          ? new Date(order.deliveredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : order.scheduledDate
                          ? new Date(order.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(order)}
                            className="p-1.5 text-slate-400 hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Full Order Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Collect Payment — show as Collect ₹X when there's a due amount */}
                          {(() => {
                            const pst = getOrderPaymentState(order);
                            return pst.hasDue ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(order)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title={`Collect payment — ₹${pst.due.toFixed(2)} due`}
                              >
                                <CreditCard className="w-3 h-3" />
                                Collect ₹{pst.due.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </button>
                            ) : null;
                          })()}

                          {/* Update Status (if not delivered or cancelled) */}
                          {!isDeliveredOrFinalized && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenStatusModal(order)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Update Status"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancel Order (if not delivered or cancelled) */}
                          {!isDeliveredOrFinalized && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(order)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Cancel Order"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete (only if in initial/draft state) */}
                          {(order.status === 'NEW' || order.status === 'PENDING') && (
                            <button
                              type="button"
                              onClick={() => setDeleteModalOrder(order)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Draft Order"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 5. PAGINATION BAR ────────────────────────────────────── */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing {totalMatching === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, totalMatching)} of {totalMatching} orders
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none"
            >
              <option value={15}>15 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3 py-1 font-bold text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL: CREATE ORDER ────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#1677C8]" />
                  Create Customer Order
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Place an authoritative customer order with calculated pricing
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateOrderSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Customer & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Customer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCustomerId}
                    onChange={(e) => {
                      setFormCustomerId(e.target.value);
                      const cust = customersList.find((c) => c.id === e.target.value);
                      if (cust?.addresses && cust.addresses.length > 0) {
                        setFormDeliveryAddressId(cust.addresses[0].id);
                      } else {
                        setFormDeliveryAddressId('');
                      }
                    }}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customersList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.user?.firstName} {c.user?.lastName} ({c.user?.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={new Date().toISOString().split('T')[0]}
                    disabled
                    className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formScheduledDate}
                    onChange={(e) => setFormScheduledDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Delivery Address selection if customer selected */}
              {formSelectedCustomer && (
                <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#1677C8] shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-700">Delivery Address: </span>
                    {formSelectedCustomer.addresses && formSelectedCustomer.addresses.length > 0 ? (
                      <select
                        value={formDeliveryAddressId}
                        onChange={(e) => setFormDeliveryAddressId(e.target.value)}
                        className="ml-2 bg-white border border-sky-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                      >
                        {formSelectedCustomer.addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.street}, {a.city} {a.zipCode ? `(${a.zipCode})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-500 italic">Default address will be snapshot automatically</span>
                    )}
                  </div>
                </div>
              )}

              {/* Line items table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#1677C8]" />
                    Order Items
                  </h4>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 w-20">Qty</th>
                        <th className="p-2.5 w-24">Rate (₹)</th>
                        <th className="p-2.5 w-24">Disc (₹)</th>
                        <th className="p-2.5 w-20">Tax %</th>
                        <th className="p-2.5 w-24 text-right">Amount (₹)</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2">
                            <select
                              value={item.productId}
                              onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              required
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
                            >
                              <option value="">-- Choose Product --</option>
                              {catalogProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (₹{p.price})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              required
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-[#1677C8]"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                              required
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right outline-none focus:border-[#1677C8]"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.discount}
                              onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-right outline-none focus:border-[#1677C8]"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-center outline-none focus:border-[#1677C8]"
                            />
                          </td>
                          <td className="p-2 text-right font-black text-slate-800">
                            ₹{item.total.toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={formItems.length === 1}
                              className="p-1 text-slate-300 hover:text-rose-500 disabled:opacity-20 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Financials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                {/* Payment setup */}
                <div className="space-y-3">
                  <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#1677C8]" />
                    Initial Payment
                  </h5>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#1677C8]"
                    >
                      <option value="CASH">Cash on Delivery (COD)</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CARD">Card</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Amount Paid Now (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formInitialPaymentAmount}
                      onChange={(e) => setFormInitialPaymentAmount(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Notes / Instructions
                    </label>
                    <input
                      type="text"
                      placeholder="Optional delivery notes..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8]"
                    />
                  </div>
                </div>

                {/* Live Authoritative Totals Box */}
                <div className="space-y-2 text-xs">
                  <h5 className="font-black text-slate-700 uppercase tracking-wider mb-2">
                    Order Summary
                  </h5>

                  <div className="flex justify-between text-slate-600 font-semibold py-1 border-b border-slate-200/50">
                    <span>Subtotal:</span>
                    <span>₹{formCalculations.subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600 font-semibold py-1 border-b border-slate-200/50">
                    <span>Total Discount:</span>
                    <span className="text-emerald-600">-₹{formCalculations.totalDiscount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600 font-semibold py-1 border-b border-slate-200/50">
                    <span>Taxes:</span>
                    <span>₹{formCalculations.taxTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 font-semibold py-1 border-b border-slate-200/50">
                    <span>Delivery Charge:</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        value={formDeliveryCharge}
                        onChange={(e) => setFormDeliveryCharge(e.target.value)}
                        className="w-full p-1 bg-white border border-slate-200 rounded-md text-right text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 text-sm font-black text-slate-800">
                    <span>Grand Total:</span>
                    <span className="text-base text-[#1677C8]">₹{formCalculations.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrder}
                  className="px-5 py-2 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isCreatingOrder ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    'Create Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL / DRAWER: ORDER DETAILS ─────────────────────────── */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-800 text-lg">
                    Order #ORD-{formatOrderId(selectedOrder.id)}
                  </h3>
                  {getStatusBadge(selectedOrder.status)}
                  {getPaymentStatusBadge(selectedOrder.paymentStatus, selectedOrder.amountDue)}
                  {isLoadingDetails && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1677C8]" />}
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Customer and Delivery Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#1677C8]" />
                    Customer Details
                  </h5>
                  <div className="font-black text-slate-800 text-sm">
                    {selectedOrder.customer?.user?.firstName} {selectedOrder.customer?.user?.lastName}
                  </div>
                  {selectedOrder.customer?.user?.phone && (
                    <div className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedOrder.customer.user.phone}
                    </div>
                  )}
                  {selectedOrder.customer?.companyName && (
                    <div className="text-xs text-slate-500 font-medium">
                      Company: {selectedOrder.customer.companyName}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#1677C8]" />
                    Delivery Destination
                  </h5>
                  <div className="text-xs font-semibold text-slate-700 leading-relaxed">
                    {selectedOrder.address?.street || 'Main Location'}
                    {selectedOrder.address?.city && `, ${selectedOrder.address.city}`}
                    {selectedOrder.address?.district && `, ${selectedOrder.address.district}`}
                    {selectedOrder.address?.state && `, ${selectedOrder.address.state}`}
                    {selectedOrder.address?.zipCode && ` - ${selectedOrder.address.zipCode}`}
                  </div>
                  {selectedOrder.scheduledDate && (
                    <div className="text-[11px] font-bold text-[#1677C8] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Scheduled: {new Date(selectedOrder.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div>
                <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Line Items ({selectedOrder.items?.length || 0})
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Unit Rate</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {selectedOrder.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">
                            <div className="font-bold text-slate-800">{item.product?.name || 'Product'}</div>
                            {item.product?.isJar && (
                              <span className="text-[10px] font-bold text-sky-600 uppercase">20L Returnable Jar</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                          <td className="p-2.5 text-right">₹{Number(item.unitPrice).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-black text-slate-800">
                            ₹{Number(item.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Payments Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    Financials
                  </h5>
                  <div className="flex justify-between text-xs text-slate-600 font-semibold">
                    <span>Subtotal:</span>
                    <span>₹{Number(selectedOrder.subTotal).toFixed(2)}</span>
                  </div>
                  {Number(selectedOrder.discountTotal) > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                      <span>Discount:</span>
                      <span>-₹{Number(selectedOrder.discountTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(selectedOrder.deliveryCharge) > 0 && (
                    <div className="flex justify-between text-xs text-slate-600 font-semibold">
                      <span>Delivery Charge:</span>
                      <span>+₹{Number(selectedOrder.deliveryCharge).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-800 pt-2 border-t border-slate-200">
                    <span>Total Amount:</span>
                    <span>₹{Number(selectedOrder.totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Amount Paid:</span>
                    <span>₹{Number(selectedOrder.amountPaid || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-700 font-black">
                    <span>Remaining Due:</span>
                    <span>₹{Number(selectedOrder.amountDue || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Payments Recorded */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Recorded Payments ({selectedOrder.payments?.length || 0})
                    </h5>
                    {selectedOrder.paymentStatus !== 'PAID' && (
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(selectedOrder)}
                        className="text-xs font-bold text-[#1677C8] hover:underline"
                      >
                        + Record
                      </button>
                    )}
                  </div>
                  {selectedOrder.payments && selectedOrder.payments.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {selectedOrder.payments.map((p) => (
                        <div key={p.id} className="p-2 bg-white rounded-xl border border-slate-200/60 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800">₹{p.amount.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5 font-semibold uppercase">via {p.provider}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {new Date(p.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">No payments recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Status History Audit Timeline */}
              {selectedOrder.history && selectedOrder.history.length > 0 && (
                <div>
                  <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Audit Trail & Status History
                  </h5>
                  <div className="space-y-2 border-l-2 border-sky-200 pl-4 ml-2">
                    {selectedOrder.history.map((h) => (
                      <div key={h.id} className="relative text-xs">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#1677C8] border-2 border-white" />
                        <div className="font-bold text-slate-800">
                          {h.previousStatus} <ArrowRight className="w-3 h-3 inline text-slate-400" /> {h.newStatus}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {new Date(h.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {h.user && ` by ${h.user.firstName || ''} ${h.user.lastName || ''}`}
                          {h.reason && ` • ${h.reason}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer action bar inside drawer */}
            <div className="px-6 py-3 border-t border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => handleOpenStatusModal(selectedOrder)}
                    className="px-3 py-1.5 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Update Status
                  </button>
                )}

                {selectedOrder.paymentStatus !== 'PAID' && (
                  <button
                    type="button"
                    onClick={() => handleOpenPaymentModal(selectedOrder)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Record Payment
                  </button>
                )}
              </div>

              <div>
                {selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => handleOpenCancelModal(selectedOrder)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: UPDATE STATUS ──────────────────────────────────── */}
      {statusModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-base">
                Update Order Status
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusUpdateSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-semibold">Order: </span>
                <span className="font-black text-slate-800">#ORD-{formatOrderId(statusModalOrder.id)}</span>
                <div className="mt-1">
                  <span className="text-slate-500 font-semibold">Current Status: </span>
                  {getStatusBadge(statusModalOrder.status)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newTargetStatus}
                  onChange={(e) => setNewTargetStatus(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8]"
                >
                  {getAllowedStatusTransitions(statusModalOrder.status).map((st) => (
                    <option key={st} value={st}>
                      {formatOrderStatus(st)}
                    </option>
                  ))}
                </select>
              </div>

              {(newTargetStatus === 'DELIVERED' || newTargetStatus === 'COMPLETED') && (() => {
                const pst = getOrderPaymentState(statusModalOrder);
                const partialAmt = Number(deliveryPaymentAmount) || 0;
                const previewPaid = deliveryPaymentMode === 'FULL' ? pst.due : partialAmt;
                const previewDue = deliveryPaymentMode === 'FULL' ? 0 : Math.max(0, pst.due - partialAmt);
                return (
                  <div className="space-y-3">
                    {/* Payment Status toggle */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Payment Status <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryPaymentMode('FULL')}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            deliveryPaymentMode === 'FULL'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Fully Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryPaymentMode('PARTIAL')}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            deliveryPaymentMode === 'PARTIAL'
                              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Partial
                        </button>
                      </div>
                    </div>

                    {/* Partial amount input */}
                    {deliveryPaymentMode === 'PARTIAL' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Amount Paid <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center">
                          <span className="px-2.5 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs font-bold text-slate-600">₹</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={pst.due}
                            placeholder={`Max ₹${pst.due.toFixed(2)}`}
                            value={deliveryPaymentAmount}
                            onChange={(e) => setDeliveryPaymentAmount(e.target.value)}
                            className="flex-1 p-2 bg-white border border-slate-200 rounded-r-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Payment Method */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                      <select
                        value={deliveryPaymentMethod}
                        onChange={(e) => setDeliveryPaymentMethod(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8]"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CARD">Card</option>
                      </select>
                    </div>

                    {/* Financial Summary */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Order Total</span>
                        <span className="font-bold text-slate-800">₹{pst.total.toFixed(2)}</span>
                      </div>
                      {pst.paid > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Previously Paid</span>
                          <span className="font-semibold text-emerald-700">₹{pst.paid.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>Paying Now</span>
                        <span className="font-bold text-emerald-700">₹{previewPaid.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 flex justify-between">
                        <span className="font-bold text-slate-700">Remaining Due</span>
                        <span className={`font-black ${previewDue > 0 ? 'text-orange-600' : 'text-emerald-700'}`}>
                          ₹{previewDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}


              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Comment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dispatched with route #3..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOrder(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus || !newTargetStatus}
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpdatingStatus ? 'Updating...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RECORD PAYMENT ──────────────────────────────────── */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Collect Payment
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Total Order Amount:</span>
                  <span className="font-bold text-slate-800">₹{Number(paymentModalOrder.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Already Paid:</span>
                  <span className="font-bold text-emerald-600">₹{Number(paymentModalOrder.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200/60 font-black">
                  <span className="text-amber-700">Remaining Balance Due:</span>
                  <span className="text-amber-700">₹{Number(paymentModalOrder.amountDue !== undefined ? paymentModalOrder.amountDue : paymentModalOrder.totalAmount).toFixed(2)}</span>
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
                  max={paymentModalOrder.amountDue !== undefined ? paymentModalOrder.amountDue : paymentModalOrder.totalAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
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
                  placeholder="e.g. UPI-998822 or Cheque #102..."
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmittingPayment ? 'Collecting...' : 'Collect Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CANCEL ORDER ────────────────────────────────────── */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-rose-600 text-base flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Cancel Order
              </h3>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 font-semibold">
                Are you sure you want to cancel order{' '}
                <span className="font-black text-slate-800">#ORD-{formatOrderId(cancelModalOrder.id)}</span>?
                This action is destructive and will be recorded in the audit history.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this order is being cancelled..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE DRAFT ORDER ──────────────────────────────── */}
      {deleteModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-800 text-base">Delete Draft Order?</h3>
            <p className="text-xs text-slate-500 font-medium mt-1 mb-5">
              Permanently delete draft order #ORD-{formatOrderId(deleteModalOrder.id)}? This cannot be undone.
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOrder(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
