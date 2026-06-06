import { motion } from 'framer-motion';
import { CheckCircle, Copy, ShoppingBag, ArrowRight } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchWithAuth('/order')
        .then((data: any[]) => {
          const currentOrder = data.find(o => o.id === orderId);
          setOrder(currentOrder);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      toast.success('Order ID copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-[#E2E8F0] border-t-[#1E88E5] rounded-full" />
      </div>
    );
  }

  // Safe Math Calculations to prevent NaN
  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const calculateItemsTotal = () => {
    if (!order || !order.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum: number, item: any) => sum + (safeNumber(item.price) * safeNumber(item.quantity)), 0);
  };

  const calculateDepositTotal = () => {
    if (!order || !order.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum: number, item: any) => sum + (safeNumber(item.depositAmount) * safeNumber(item.quantity)), 0);
  };

  const itemsTotal = calculateItemsTotal();
  const depositTotal = calculateDepositTotal();
  const deliveryCharge = safeNumber(order?.deliveryCharge);
  
  // If order total is explicit, use it. Otherwise compute it safely.
  const grandTotal = safeNumber(order?.totalAmount) || (itemsTotal + deliveryCharge);

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-[#F8FAFC] text-[#0F172A] px-4 sm:px-6 py-8">
      <div className="w-full max-w-[700px] flex flex-col space-y-6 md:space-y-8 my-auto">
        
        {/* Success Hero */}
        <section className="flex flex-col items-center text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="w-24 h-24 bg-[#EBF5FB] rounded-full flex items-center justify-center mb-2"
          >
            <CheckCircle className="w-12 h-12 text-[#1E88E5]" />
          </motion.div>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h1 className="text-[28px] md:text-[36px] font-bold text-[#0F172A] tracking-tight">
              Order Confirmed
            </h1>
            <p className="text-[16px] font-medium text-[#64748B] max-w-sm mx-auto">
              Your order has been placed successfully and is being processed.
            </p>
            
            {orderId && (
              <div className="pt-2">
                <button 
                  onClick={copyOrderId}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E2E8F0] rounded-full text-[14px] font-semibold text-[#0F172A] shadow-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                >
                  Order #{orderId.substring(0, 8).toUpperCase()}
                  <Copy className="w-4 h-4 text-[#64748B] group-hover:text-[#1E88E5]" />
                </button>
              </div>
            )}
          </motion.div>
        </section>

        {/* Order Summary Card */}
        {order && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 md:p-8 rounded-[24px] border border-[#E2E8F0] shadow-sm"
          >
            <h2 className="text-[20px] font-bold text-[#0F172A] mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6 border-b border-[#E2E8F0] pb-6">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0 overflow-hidden">
                    {item.product?.images?.[0]?.url ? (
                       <img src={item.product.images[0].url} alt="Product" className="object-cover w-full h-full" />
                    ) : (
                       <ShoppingBag className="w-6 h-6 text-[#64748B]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#0F172A] truncate">{item.product?.name || 'Water Jar'}</p>
                    <p className="text-[14px] text-[#64748B]">Qty: {safeNumber(item.quantity)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-[#0F172A]">₹{safeNumber(item.price) * safeNumber(item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-[14px] font-medium text-[#64748B] mb-6 border-b border-[#E2E8F0] pb-6">
              <div className="flex justify-between">
                <span>Products Total</span>
                <span className="text-[#0F172A] font-semibold">₹{itemsTotal}</span>
              </div>
              
              {depositTotal > 0 && (
                <div className="flex justify-between items-center text-[#0F172A]">
                  <span>Security Deposit</span>
                  <span className="font-semibold">₹{depositTotal}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Delivery Charge</span>
                <span className="text-[#0F172A] font-semibold">
                  {deliveryCharge === 0 ? <span className="text-[#1E88E5]">Free</span> : `₹${deliveryCharge}`}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[18px] font-bold text-[#0F172A]">Total Amount</span>
              <span className="text-[32px] font-bold text-[#1E88E5]">₹{grandTotal}</span>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-3 md:flex-row md:justify-between w-full"
        >
          <button 
            onClick={() => navigate('/customer/deliveries')}
            className="w-full md:flex-1 h-[56px] rounded-[16px] bg-[#1E88E5] text-white font-semibold text-[15px] shadow-sm hover:bg-[#1565C0] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Track My Order <ArrowRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => navigate('/customer/shop')}
            className="w-full md:flex-1 h-[56px] rounded-[16px] bg-white border border-[#E2E8F0] text-[#0F172A] font-semibold text-[15px] hover:bg-[#F8FAFC] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
          >
            Continue Shopping
          </button>
        </motion.div>

      </div>
    </div>
  );
}
