import { Link } from 'react-router-dom';
import { useMyOrders } from '../../lib/shopApi';
import ClayCard from '../../components/shop/ui/ClayCard';
import { Package, ChevronRight, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  PENDING:          { label: 'Placed',            color: 'bg-yellow-100 text-yellow-700',   step: 0 },
  CONFIRMED:        { label: 'Confirmed',          color: 'bg-blue-100 text-blue-700',       step: 1 },
  ASSIGNED:         { label: 'Assigned',           color: 'bg-indigo-100 text-indigo-700',   step: 2 },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',   color: 'bg-orange-100 text-orange-700',   step: 3 },
  DELIVERED:        { label: 'Delivered',          color: 'bg-green-100 text-green-700',     step: 4 },
  CANCELLED:        { label: 'Cancelled',          color: 'bg-red-100 text-red-700',         step: -1 },
  FAILED:           { label: 'Failed',             color: 'bg-red-100 text-red-700',         step: -1 },
};

const TIMELINE_STEPS = ['Placed', 'Confirmed', 'Assigned', 'Out for Delivery', 'Delivered'];

export function OrderStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function OrderTimeline({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const currentStep = cfg.step;
  if (currentStep === -1) return null;

  return (
    <div className="flex items-center justify-between w-full">
      {TIMELINE_STEPS.map((label, i) => (
        <div key={label} className="flex flex-col items-center flex-1 relative">
          {i < TIMELINE_STEPS.length - 1 && (
            <div
              className={`absolute top-2.5 left-1/2 w-full h-0.5 transition-colors
                ${i < currentStep ? 'bg-primary' : 'bg-border'}`}
            />
          )}
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 transition-colors
              ${i <= currentStep ? 'bg-primary border-primary' : 'bg-background border-border'}`}
          >
            {i < currentStep && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            )}
          </div>
          <span className={`text-[9px] mt-1 font-medium text-center leading-tight
            ${i <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
            {label.split(' ').map((w, j) => (
              <span key={j} className="block">{w}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Orders() {
  const { data: orders = [], isLoading } = useMyOrders();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="clay-card animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Package className="w-10 h-10 text-primary" />
        </div>
        <h3 className="font-bold text-xl">No orders yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your orders will appear here. Start shopping!
        </p>
        <Link to="/" className="clay-btn mt-2 px-8">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <h2 className="text-2xl font-bold ml-1">My Orders</h2>
      {orders.map((order) => (
        <Link to={`/orders/${order.id}`} key={order.id}>
          <ClayCard className="hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">
                  Order #{order.id.slice(-8).toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <OrderStatusBadge status={order.status} />
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Items preview */}
            <p className="text-xs text-muted-foreground mb-3">
              {order.items?.map((i) => `${i.product?.name} ×${i.quantity}`).join(', ')}
            </p>

            {/* Timeline */}
            <OrderTimeline status={order.status} />

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {order.paymentMethod} · {order.paymentStatus}
              </span>
              <span className="font-bold text-primary">₹{Number(order.payableAmount)}</span>
            </div>
          </ClayCard>
        </Link>
      ))}
    </div>
  );
}
