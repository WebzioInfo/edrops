import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, CheckCircle2, Clock3, AlertCircle, XCircle, Route, MapPin, CalendarDays } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';

interface Delivery {
  id: string;
  scheduledFor: string;
  deliveredAt: string | null;
  status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SKIPPED' | 'FAILED';
  quantity: number;
  emptyJarsCollected: number;
  notes: string | null;
}

export default function TrackPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDeliveryData() {
      try {
        const data = await fetchWithAuth('/deliveries/history');
        setDeliveries(data || []);
      } catch {
        setDeliveries([]);
      } finally {
        setLoading(false);
      }
    }
    loadDeliveryData();
  }, []);

  const getStatusIcon = (status: Delivery['status']) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'PENDING':
      case 'ASSIGNED':
      case 'IN_TRANSIT':
        return <Clock3 className="h-5 w-5 text-[#2D79A8]" />;
      case 'SKIPPED':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-rose-600" />;
    }
  };

  const getStatusClass = (status: Delivery['status']) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'PENDING':
      case 'ASSIGNED':
      case 'IN_TRANSIT':
        return 'bg-[#BBDFF2]/30 text-[#2D79A8] border-[#BBDFF2]/60';
      case 'SKIPPED':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative h-16 w-16 rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30">
          <div className="absolute inset-2 animate-ping rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  const activeDelivery = deliveries.find(d => d.status === 'PENDING' || d.status === 'IN_TRANSIT' || d.status === 'ASSIGNED');
  const historicalDeliveries = deliveries.filter(d => d.status !== 'PENDING' && d.status !== 'IN_TRANSIT' && d.status !== 'ASSIGNED');

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-6">
      
      {/* 1. Header */}
      <div>
        <h1 className="text-3xl font-black text-[#245361]">Delivery Tracker</h1>
        <p className="text-sm font-semibold text-[#245361]/80 mt-1">Track pending deliveries and browse historical hydration logs</p>
      </div>

      {/* 2. Current / Active Delivery Status */}
      {activeDelivery && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card p-6 border border-[#BBDFF2] bg-gradient-to-r from-white to-[#BBDFF2]/10"
        >
          <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2D79A8] text-white">
                <Truck className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-black uppercase text-[#245361]/85 tracking-wider">Scheduled Delivery</p>
                <h3 className="text-xl font-black text-[#245361]">
                  {new Date(activeDelivery.scheduledFor).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
              </div>
            </div>
            <span className="rounded-full bg-[#BBDFF2]/50 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#2D79A8]">
              {activeDelivery.status}
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Route className="h-5 w-5 text-[#2D79A8]" />
                <div>
                  <p className="text-xs font-black uppercase text-[#245361]/85 tracking-wider">Estimated Quantity</p>
                  <p className="text-base font-bold text-[#245361]">{activeDelivery.quantity} x 20L Water Jars</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-[#2D79A8]" />
                <div>
                  <p className="text-xs font-black uppercase text-[#245361]/85 tracking-wider">Delivery Instructions</p>
                  <p className="text-sm font-semibold text-slate-800">{activeDelivery.notes ?? 'None set'}</p>
                </div>
              </div>
            </div>

            <div className="bg-background rounded-2xl p-4 border border-border/80">
              <p className="text-xs font-black uppercase text-[#245361]/85 tracking-wider">Hydration Guidance</p>
              <p className="text-sm text-slate-800 mt-2">
                Keep the same number of empty jars ({activeDelivery.quantity}) ready outside your door to hand over during exchange.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3. Delivery Log Timeline */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="clay-card p-6"
      >
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-6">
          <CalendarDays className="h-6 w-6 text-[#2D79A8]" />
          <h2 className="text-xl font-black text-[#245361]">Delivery Logs</h2>
        </div>

        <div className="relative border-l border-border/80 ml-4 pl-6 space-y-6">
          {historicalDeliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="relative"
            >
              {/* Dot Icon */}
              <span className="absolute -left-[37px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border">
                {getStatusIcon(delivery.status)}
              </span>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-base font-black text-[#245361]">
                    {new Date(delivery.scheduledFor).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </h4>
                  {delivery.deliveredAt && (
                    <p className="text-xs text-slate-700 font-semibold mt-0.5">
                      Delivered at {new Date(delivery.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {delivery.notes && (
                    <p className="text-xs text-amber-700 font-medium mt-1">Note: {delivery.notes}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    {delivery.quantity} Jars ({delivery.emptyJarsCollected} returned)
                  </span>
                  <span className={`rounded-full border px-3 py-0.5 text-xs font-black uppercase tracking-wider ${getStatusClass(delivery.status)}`}>
                    {delivery.status.toLowerCase()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          {historicalDeliveries.length === 0 && (
            <p className="text-center text-sm font-semibold text-slate-700 py-6">No historical records found.</p>
          )}
        </div>
      </motion.section>

    </div>
  );
}
