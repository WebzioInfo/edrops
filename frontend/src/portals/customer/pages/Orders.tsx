import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, ChevronRight, Ban, X, Download, MapPin, ShoppingBag, ShoppingCart, Truck, XCircle, CheckCircle2 } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    Promise.all([
      fetchWithAuth('/order'),
      fetchWithAuth('/address')
    ]).then(([orderData, addressData]) => {
      setOrders(Array.isArray(orderData) ? orderData : []);
      setAddresses(Array.isArray(addressData) ? addressData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedOrder]);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => ['PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length;
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PROCESSING': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'OUT_FOR_DELIVERY': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'DELIVERED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'CANCELLED': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'PENDING': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTimelineStep = (status: string) => {
    switch (status) {
      case 'PENDING': return 0;
      case 'CONFIRMED': return 1;
      case 'PROCESSING': return 2;
      case 'OUT_FOR_DELIVERY': return 3;
      case 'DELIVERED': return 4;
      default: return 0;
    }
  };

  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="h-10 w-10 border-4 border-[#E2E8F0] border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  const deliveryAddress = selectedOrder ? addresses.find(a => a.id === selectedOrder.deliveryAddressId) : null;

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* MAIN APPLICATION (HIDDEN DURING PRINT)                        */}
      {/* ------------------------------------------------------------- */}
      <div className="min-h-screen bg-[#F8FAFC] pb-[100px] lg:pb-12 text-[#0F172A] print:hidden">
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10">

          {/* PAGE HEADER */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-[24px] md:text-[32px] font-bold text-[#0F172A] mb-1 md:mb-2">Orders</h1>
            <p className="text-[14px] md:text-[16px] text-[#64748B]">Track and manage all your water deliveries.</p>
          </div>

          {/* SUMMARY CARDS */}
          {orders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-10">
              <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <span className="text-[13px] font-semibold text-[#64748B]">Total Orders</span>
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-blue-500" /></div>
                </div>
                <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{totalOrders}</span>
              </div>
              <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <span className="text-[13px] font-semibold text-[#64748B]">Pending</span>
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center"><Clock className="w-4 h-4 text-orange-500" /></div>
                </div>
                <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{pendingOrders}</span>
              </div>
              <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <span className="text-[13px] font-semibold text-[#64748B]">Delivered</span>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
                </div>
                <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{deliveredOrders}</span>
              </div>
              <div className="bg-white p-4 md:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <span className="text-[13px] font-semibold text-[#64748B]">Cancelled</span>
                  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center"><XCircle className="w-4 h-4 text-rose-500" /></div>
                </div>
                <span className="text-[20px] md:text-[24px] font-bold text-[#0F172A]">{cancelledOrders}</span>
              </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm p-8 md:p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-[#F8FAFC] rounded-full flex items-center justify-center mb-6 border border-[#E2E8F0]">
                <Package className="h-10 w-10 text-[#64748B]" />
              </div>
              <h2 className="text-[20px] md:text-[24px] font-bold text-[#0F172A] mb-2">No Orders Yet</h2>
              <p className="text-[#64748B] text-[14px] md:text-[15px] mb-8 max-w-md">Order your first water jar.</p>
              <a href="/customer/shop" className="px-8 py-3.5 rounded-[12px] bg-[#2563EB] text-white font-semibold shadow-sm hover:bg-[#1D4ED8] transition-colors cursor-pointer inline-flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Shop Now
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white rounded-[16px] p-4 border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all duration-150 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[11px] font-bold bg-[#F8FAFC] text-[#0F172A] px-2 py-1 rounded-md uppercase tracking-wider border border-[#E2E8F0]">
                        #{order.id.substring(0, 8)}
                      </span>
                      <span className="text-[12px] font-medium text-[#64748B]">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-[#0F172A] mb-1 line-clamp-1">
                      {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')}
                    </h3>
                    <p className="text-[12px] font-medium text-[#64748B] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#94A3B8]" /> Slot: {order.timeSlot || 'Standard'}
                    </p>
                  </div>
                  <div className="md:w-[160px] flex items-center">
                    <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                      {order.status === 'DELIVERED' && <CheckCircle2 className="w-3 h-3" />}
                      {order.status === 'CANCELLED' && <Ban className="w-3 h-3" />}
                      {order.status === 'CONFIRMED' && <CheckCircle className="w-3 h-3" />}
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-4 md:w-[200px] pt-3 md:pt-0 border-t border-[#E2E8F0] md:border-0">
                    <div className="text-[16px] md:text-[18px] font-bold text-[#0F172A]">₹{safeNumber(order.totalAmount)}</div>
                    <button className="h-[36px] px-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-[12px] font-semibold group-hover:bg-[#2563EB] group-hover:text-white group-hover:border-[#2563EB] transition-colors flex items-center gap-1">
                      Details <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ORDER DETAILS MODAL / DRAWER */}
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-[100] flex flex-col justify-end md:items-center md:justify-start pointer-events-none">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedOrder(null)}
                className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm pointer-events-auto"
              />

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full max-w-[800px] bg-white rounded-t-[20px] md:rounded-[16px] flex flex-col shadow-2xl pointer-events-auto md:mt-[64px] max-h-[calc(100vh-88px)] mt-10 md:max-h-[80vh]"
              >
                {/* Modal Header */}
                <div className="flex-none bg-white z-10 border-b border-[#E2E8F0] px-4 py-3.5 flex items-center justify-between rounded-t-[20px] md:rounded-t-[16px]">
                  <div>
                    <h2 className="text-[16px] md:text-[18px] font-bold text-[#0F172A] flex items-center gap-2">
                      Order #{selectedOrder.id.substring(0, 8).toUpperCase()}
                      <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status.replace(/_/g, ' ')}
                      </span>
                    </h2>
                    <p className="text-[11px] md:text-[12px] font-medium text-[#64748B] mt-0.5">
                      Placed on {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="w-8 h-8 rounded-full bg-[#F8FAFC] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 md:space-y-5 bg-[#F8FAFC]">

                  {/* Products */}
                  <section className="bg-white rounded-[12px] p-3 md:p-4 border border-[#E2E8F0] shadow-sm">
                    <h3 className="text-[13px] md:text-[14px] font-bold text-[#0F172A] mb-3 uppercase tracking-wider border-b border-[#E2E8F0] pb-2">Products</h3>
                    <div className="space-y-2.5">
                      {selectedOrder.items?.map((item: any) => {
                        const unitPrice = safeNumber(item.unitPrice);
                        const qty = safeNumber(item.quantity);
                        const subtotal = unitPrice * qty;
                        return (
                          <div key={item.id} className="flex gap-3 items-center">
                            <div className="w-12 h-12 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0] flex items-center justify-center overflow-hidden shrink-0">
                              {item.product?.images?.[0]?.url ? (
                                <img src={item.product.images[0].url} alt={item.product.name} className="object-cover w-full h-full" />
                              ) : (
                                <ShoppingBag className="w-5 h-5 text-[#64748B]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="font-semibold text-[13px] md:text-[14px] text-[#0F172A] truncate">{item.product?.name || 'Water Jar'}</p>
                              <p className="text-[11px] md:text-[12px] font-medium text-[#64748B]">Qty: {qty}</p>
                            </div>
                            <div className="flex flex-col justify-center text-right">
                              <p className="text-[13px] md:text-[14px] font-bold text-[#0F172A]">₹{subtotal}</p>
                              <p className="text-[10px] md:text-[11px] text-[#64748B]">₹{unitPrice} each</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Delivery Info */}
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-white p-3 md:p-4 rounded-[12px] border border-[#E2E8F0] shadow-sm">
                      <div className="flex gap-2">
                        <MapPin className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Delivery Address</p>
                          {deliveryAddress ? (
                            <>
                              <p className="text-[12px] font-semibold text-[#0F172A] leading-snug">{deliveryAddress.label || 'Address'}</p>
                              <p className="text-[11px] md:text-[12px] text-[#64748B] mt-0.5">{deliveryAddress.street}</p>
                              <p className="text-[11px] md:text-[12px] text-[#64748B]">{deliveryAddress.city} {deliveryAddress.zipCode}</p>
                            </>
                          ) : (
                            <p className="text-[12px] font-semibold text-[#0F172A]">Not available</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-3 md:p-4 rounded-[12px] border border-[#E2E8F0] shadow-sm">
                      <div className="flex gap-2">
                        <Clock className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Delivery Slot</p>
                          <p className="text-[12px] font-semibold text-[#0F172A] leading-snug">{selectedOrder.timeSlot || 'Standard Delivery'}</p>
                          <p className="text-[11px] text-[#64748B] mt-0.5">Expected Delivery</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Payment Info */}
                  <section className="bg-white rounded-[12px] p-3 md:p-4 border border-[#E2E8F0] shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[12px] md:text-[13px] font-semibold text-[#64748B]">Payment Method</span>
                      <span className="text-[11px] md:text-[12px] font-bold text-[#0F172A] bg-[#F8FAFC] px-2.5 py-1 rounded-[6px] border border-[#E2E8F0]">
                        {selectedOrder.paymentMethod || 'ONLINE'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[12px] md:text-[13px] font-medium text-[#64748B] border-b border-[#E2E8F0] pb-3 mb-3">
                      <div className="flex justify-between">
                        <span>Product Total</span>
                        <span className="text-[#0F172A] font-semibold">₹{safeNumber(selectedOrder.subTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Charge</span>
                        <span className="text-[#0F172A] font-semibold">₹{safeNumber(selectedOrder.deliveryCharge)}</span>
                      </div>
                      {safeNumber(selectedOrder.depositTotal) > 0 && (
                        <div className="flex justify-between">
                          <span>Deposit</span>
                          <span className="text-[#0F172A] font-semibold">₹{safeNumber(selectedOrder.depositTotal)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] md:text-[15px] font-bold text-[#0F172A]">Grand Total</span>
                      <span className="text-[18px] md:text-[20px] font-bold text-[#2563EB]">₹{safeNumber(selectedOrder.totalAmount)}</span>
                    </div>
                  </section>

                  {/* Timeline */}
                  <section className="bg-white rounded-[12px] p-3 md:p-4 border border-[#E2E8F0] shadow-sm">
                    <h3 className="text-[13px] md:text-[14px] font-bold text-[#0F172A] mb-4 uppercase tracking-wider border-b border-[#E2E8F0] pb-2">Timeline</h3>
                    <div className="relative pb-1">
                      <div className="absolute left-[11px] top-0 bottom-0 w-[3px] bg-[#E2E8F0] rounded-full md:left-0 md:top-[11px] md:bottom-auto md:w-full md:h-[3px] z-0"></div>
                      <div
                        className="absolute left-[11px] top-0 w-[3px] bg-[#2563EB] rounded-full md:left-0 md:top-[11px] md:w-auto md:h-[3px] z-0 transition-all"
                        style={{
                          height: window.innerWidth < 768 ? `${(Math.min(getTimelineStep(selectedOrder.status), 3) / 3) * 100}%` : '3px',
                          width: window.innerWidth >= 768 ? `${(Math.min(getTimelineStep(selectedOrder.status), 3) / 3) * 100}%` : '3px'
                        }}
                      ></div>

                      <div className="relative z-10 flex flex-col md:flex-row justify-between gap-4 md:gap-0">
                        {['Confirmed', 'Processing', 'Out For Delivery', 'Delivered'].map((step, index) => {
                          const isCompleted = index <= getTimelineStep(selectedOrder.status);
                          return (
                            <div key={step} className="flex md:flex-col items-center gap-3 md:gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-[2px] bg-white transition-colors duration-500 shrink-0 ${isCompleted ? 'border-[#2563EB] text-[#2563EB]' : 'border-[#E2E8F0] text-[#E2E8F0]'}`}>
                                {isCompleted ? <CheckCircle className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-[#E2E8F0]"></div>}
                              </div>
                              <span className={`text-[12px] font-semibold md:text-center ${isCompleted ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                                {step}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                </div>

                {/* Modal Footer (Sticky) */}
                <div
                  className="flex-none bg-white border-t border-[#E2E8F0] px-4 pt-3 flex justify-center z-10 md:rounded-b-[16px] shadow-[0_-4px_12px_rgba(0,0,0,0.03)]"
                  style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
                >
                  <button
                    onClick={() => window.print()}
                    className="w-full md:w-[220px] h-[42px] md:h-[44px] rounded-[12px] bg-[#2563EB] text-white font-semibold text-[13px] md:text-[14px] shadow-sm hover:bg-[#1D4ED8] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download Receipt
                  </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PRINT-ONLY INVOICE (HIDDEN ON SCREEN, VISIBLE ON PRINT)       */}
      {/* ------------------------------------------------------------- */}
      {selectedOrder && (
        <div className="hidden print:block w-[794px] mx-auto bg-white text-black p-8 font-sans h-[1123px] overflow-hidden box-border">

          {/* Print Header */}
          <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-6">
            <div>
              <h1 className="text-[28px] font-black text-black m-0 leading-none tracking-tight">Edrops</h1>
              <p className="text-[12px] text-gray-500 mt-1">Order Receipt</p>
            </div>
            <div className="text-right">
              <h2 className="text-[16px] font-bold m-0">Order #{selectedOrder.id.substring(0, 8).toUpperCase()}</h2>
              <p className="text-[12px] text-gray-600 m-0 mt-1">
                Date: {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-[12px] text-gray-600 m-0 font-semibold mt-1">Status: {selectedOrder.status.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {/* Customer & Address Details */}
          <div className="flex justify-between mb-8">
            <div className="w-1/2 pr-4">
              <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
              <p className="text-[14px] font-bold m-0">{user?.firstName} {user?.lastName}</p>
              {user?.phone && <p className="text-[12px] text-gray-600 m-0 mt-1">{user.phone}</p>}
              {user?.email && <p className="text-[12px] text-gray-600 m-0 mt-1">{user.email}</p>}
            </div>
            <div className="w-1/2 pl-4 border-l border-gray-200">
              <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Delivery Address</h3>
              {deliveryAddress ? (
                <>
                  <p className="text-[14px] font-bold m-0">{deliveryAddress.label || 'Home'}</p>
                  <p className="text-[12px] text-gray-600 m-0 mt-1">{deliveryAddress.street}</p>
                  <p className="text-[12px] text-gray-600 m-0 mt-1">{deliveryAddress.city} {deliveryAddress.zipCode}</p>
                </>
              ) : (
                <p className="text-[12px] text-gray-600 m-0">No address provided</p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">Order Items</h3>
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-y border-gray-300">
                <th className="py-2 px-1 text-[12px] font-bold text-gray-600">Product</th>
                <th className="py-2 px-1 text-[12px] font-bold text-gray-600 text-center">Qty</th>
                <th className="py-2 px-1 text-[12px] font-bold text-gray-600 text-right">Unit Price</th>
                <th className="py-2 px-1 text-[12px] font-bold text-gray-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.items?.map((item: any) => {
                const unitPrice = safeNumber(item.unitPrice);
                const qty = safeNumber(item.quantity);
                const subtotal = unitPrice * qty;
                return (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-3 px-1 text-[13px] font-semibold">{item.product?.name || 'Water Jar'}</td>
                    <td className="py-3 px-1 text-[13px] text-center">{qty}</td>
                    <td className="py-3 px-1 text-[13px] text-right text-gray-600">₹{unitPrice}</td>
                    <td className="py-3 px-1 text-[13px] font-bold text-right">₹{subtotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Payment Summary */}
          <div className="flex justify-end">
            <div className="w-[300px]">
              <div className="flex justify-between py-1.5 text-[13px] border-b border-gray-100">
                <span className="text-gray-600">Product Total</span>
                <span className="font-semibold">₹{safeNumber(selectedOrder.subTotal)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-[13px] border-b border-gray-100">
                <span className="text-gray-600">Delivery Charge</span>
                <span className="font-semibold">₹{safeNumber(selectedOrder.deliveryCharge)}</span>
              </div>
              {safeNumber(selectedOrder.depositTotal) > 0 && (
                <div className="flex justify-between py-1.5 text-[13px] border-b border-gray-100">
                  <span className="text-gray-600">Deposit</span>
                  <span className="font-semibold">₹{safeNumber(selectedOrder.depositTotal)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 mt-1 items-center">
                <span className="text-[16px] font-bold">Grand Total</span>
                <span className="text-[20px] font-black">₹{safeNumber(selectedOrder.totalAmount)}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Payment Method</span>
                  <span className="text-[13px] font-bold uppercase">{selectedOrder.paymentMethod || 'ONLINE'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Print Footer */}
          <div className="mt-16 pt-6 border-t border-gray-200 text-center">
            <p className="text-[14px] font-bold m-0">Thank you for choosing Edrops!</p>
            <p className="text-[11px] text-gray-500 m-0 mt-1">If you have any questions, please contact our support team.</p>
          </div>

        </div>
      )}
    </>
  );
}
