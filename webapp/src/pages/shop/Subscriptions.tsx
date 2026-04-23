import { Link } from 'react-router-dom';
import {
  useMySubscriptions,
  usePauseSubscription,
  useResumeSubscription,
  useSkipNext,
  useCancelSubscription,
} from '../../lib/shopApi';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { CalendarHeart, Plus, Pause, Play, SkipForward, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  ACTIVE:          { label: 'Active',          color: 'bg-green-100 text-green-700' },
  PAUSED:          { label: 'Paused',          color: 'bg-yellow-100 text-yellow-700' },
  PENDING_PAYMENT: { label: 'Payment Needed',  color: 'bg-red-100 text-red-700' },
  CANCELLED:       { label: 'Cancelled',       color: 'bg-slate-100 text-slate-500' },
  EXPIRED:         { label: 'Expired',         color: 'bg-slate-100 text-slate-500' },
};

const FREQUENCY_LABEL = {
  DAILY:          'Every day',
  ALTERNATE_DAYS: 'Every 2 days',
  WEEKLY:         'Every week',
  MONTHLY:        'Every month',
};

export default function Subscriptions() {
  const { data: subscriptions = [], isLoading } = useMySubscriptions();
  const pause = usePauseSubscription();
  const resume = useResumeSubscription();
  const skipNext = useSkipNext();
  const cancel = useCancelSubscription();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="clay-card animate-pulse h-36" />
        ))}
      </div>
    );
  }

  const active = subscriptions.filter(s => ['ACTIVE', 'PAUSED', 'PENDING_PAYMENT'].includes(s.status));
  const inactive = subscriptions.filter(s => ['CANCELLED', 'EXPIRED'].includes(s.status));

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold ml-1">Subscriptions</h2>
        <Link to="/subscriptions/new">
          <ClayButton className="h-auto px-3 py-2 text-sm gap-1.5">
            <Plus className="w-4 h-4" />
            New
          </ClayButton>
        </Link>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <CalendarHeart className="w-10 h-10 text-primary" />
          </div>
          <h3 className="font-bold text-xl">No subscriptions</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Set up automatic daily deliveries and never run out of water.
          </p>
          <Link to="/subscriptions/new" className="clay-btn mt-2 px-8">
            Create Subscription
          </Link>
        </div>
      ) : (
        <>
          {active.map((sub) => {
            const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.ACTIVE;
            const isActive = sub.status === 'ACTIVE';
            const isPaused = sub.status === 'PAUSED';
            const isPending = sub.status === 'PENDING_PAYMENT';
            const isMutating = pause.isPending || resume.isPending || skipNext.isPending;

            return (
              <ClayCard key={sub.id} className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <p className="text-sm text-muted-foreground mt-2">
                      {FREQUENCY_LABEL[sub.frequency]} · ₹{Number(sub.totalAmount)}/delivery
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    #{sub.id.slice(-6).toUpperCase()}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {sub.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.product?.name}</span>
                      <span className="font-medium">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Next delivery */}
                {sub.nextDeliveryDate && (isActive || isPaused) && (
                  <div className="bg-primary/5 rounded-2xl px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Next delivery: </span>
                    <span className="font-semibold text-primary">
                      {new Date(sub.nextDeliveryDate).toLocaleDateString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                    </span>
                  </div>
                )}

                {/* Low balance warning */}
                {isPending && (
                  <div className="bg-red-50 rounded-2xl px-3 py-2 text-sm text-red-700">
                    ⚠️ Insufficient wallet balance. Recharge to resume auto-delivery.
                    <Link to="/wallet" className="block font-semibold mt-1 underline">
                      Recharge Wallet →
                    </Link>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pt-1">
                  {isActive && (
                    <>
                      <button
                        onClick={() => skipNext.mutate(sub.id)}
                        disabled={isMutating}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-card rounded-xl font-medium text-muted-foreground hover:text-foreground transition-colors"
                        style={{ boxShadow: '2px 2px 5px #d1d9e6, -2px -2px 5px #ffffff' }}
                      >
                        <SkipForward className="w-3 h-3" />
                        Skip Next
                      </button>
                      <button
                        onClick={() => pause.mutate(sub.id)}
                        disabled={isMutating}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-card rounded-xl font-medium text-yellow-600 transition-colors"
                        style={{ boxShadow: '2px 2px 5px #d1d9e6, -2px -2px 5px #ffffff' }}
                      >
                        <Pause className="w-3 h-3" />
                        Pause
                      </button>
                    </>
                  )}
                  {(isPaused || isPending) && (
                    <button
                      onClick={() => resume.mutate(sub.id)}
                      disabled={isMutating}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-50 rounded-xl font-medium text-green-600 transition-colors"
                      style={{ boxShadow: '2px 2px 5px #d1d9e6, -2px -2px 5px #ffffff' }}
                    >
                      <Play className="w-3 h-3" />
                      Resume
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm('Cancel this subscription?')) {
                        cancel.mutate(sub.id);
                      }
                    }}
                    disabled={cancel.isPending}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 rounded-xl font-medium text-red-500 transition-colors ml-auto"
                    style={{ boxShadow: '2px 2px 5px #d1d9e6, -2px -2px 5px #ffffff' }}
                  >
                    <XCircle className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </ClayCard>
            );
          })}

          {/* Inactive subscriptions */}
          {inactive.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 ml-1">Past Subscriptions</h3>
              {inactive.map((sub) => {
                const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.CANCELLED;
                return (
                  <ClayCard key={sub.id} className="opacity-60">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <p className="text-sm text-muted-foreground mt-2">
                          {FREQUENCY_LABEL[sub.frequency]}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">#{sub.id.slice(-6).toUpperCase()}</span>
                    </div>
                  </ClayCard>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
