import { useParams, useNavigate } from 'react-router-dom';
import { useOrder, useCancelOrder } from '../../lib/shopApi';
import { OrderTimeline, OrderStatusBadge } from './Orders';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { ArrowLeft, MapPin, CreditCard, Package } from 'lucide-react';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);
  const cancelOrder = useCancelOrder();

  if (isLoading) {
    return <div className="clay-card animate-pulse h-64" />;
  }

  if (!order) {
    return <p className="text-center text-muted-foreground mt-20">Order not found.</p>;
  }

  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="w-9 h-9 clay-card flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold">Order #{order.id.slice(-8).toUpperCase()}</h2>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Timeline */}
      <ClayCard>
        <h3 className="font-semibold text-sm mb-4">Delivery Status</h3>
        <OrderTimeline status={order.status} />
        {order.deliveredAt && (
          <p className="text-xs text-green-600 mt-3 text-center font-medium">
            Delivered on {new Date(order.deliveredAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        )}
      </ClayCard>

      {/* Items */}
      <ClayCard>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Order Items</h3>
        </div>
        <div className="space-y-3 divide-y divide-border">
          {order.items?.map((item) => (
            <div key={item.id} className="flex justify-between items-center pt-3 first:pt-0">
              <div>
                <p className="font-medium text-sm">{item.product?.name}</p>
                <p className="text-xs text-muted-foreground">₹{Number(item.unitPrice)} × {item.quantity}</p>
              </div>
              <span className="font-bold text-sm">₹{Number(item.totalPrice)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{Number(order.totalAmount)}</span>
          </div>
          {Number(order.depositAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deposit (refundable)</span>
              <span>₹{Number(order.depositAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base text-primary pt-1">
            <span>Total</span>
            <span>₹{Number(order.payableAmount)}</span>
          </div>
        </div>
      </ClayCard>

      {/* Address */}
      <ClayCard>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Delivery Address</h3>
        </div>
        {order.address && (
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">{order.address.label}</p>
            <p>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}</p>
            <p>{order.address.city}, {order.address.district} - {order.address.pincode}</p>
          </div>
        )}
      </ClayCard>

      {/* Payment */}
      <ClayCard>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Payment</h3>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Method</span>
          <span className="font-medium">{order.paymentMethod}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Status</span>
          <span className={`font-medium ${order.paymentStatus === 'COMPLETED' ? 'text-green-600' : 'text-yellow-600'}`}>
            {order.paymentStatus}
          </span>
        </div>
      </ClayCard>

      {/* Cancel Button */}
      {canCancel && (
        <ClayButton
          className="w-full bg-red-50 text-red-600 border-red-100"
          onClick={() => {
            if (window.confirm('Cancel this order?')) {
              cancelOrder.mutate(order.id, { onSuccess: () => navigate('/orders') });
            }
          }}
          disabled={cancelOrder.isPending}
        >
          {cancelOrder.isPending ? 'Cancelling...' : 'Cancel Order'}
        </ClayButton>
      )}
    </div>
  );
}
