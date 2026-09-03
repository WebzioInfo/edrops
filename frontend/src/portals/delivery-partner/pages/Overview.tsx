import { motion } from 'framer-motion';
import { 
  Navigation, 
  Phone, 
  CheckCircle, 
  Clock, 
  Save, 
  FileText, 
  MapPin, 
  RotateCw, 
  WifiOff, 
  Truck,
  Layers
} from 'lucide-react';

export interface DeliveryTask {
  id: string;
  status: string;
  requiredQuantity: number;
  scheduledFor?: string;
  customer?: {
    id: string;
    customerType?: string;
    companyName?: string;
    user?: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
    };
  };
  address?: {
    id: string;
    houseName?: string;
    buildingName?: string;
    street?: string;
    area?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
  };
  report?: {
    partnerDeliveredQty?: number;
    partnerEmptyCollected?: number;
    partnerNotes?: string;
    partnerSubmittedAt?: string;
  };
}

interface OverviewProps {
  tasks: DeliveryTask[];
  loading: boolean;
  onRefresh: () => void;
  onOpenReportModal: (task: DeliveryTask) => void;
  offlineQueueCount: number;
}

export default function Overview({
  tasks,
  loading,
  onRefresh,
  onOpenReportModal,
  offlineQueueCount
}: OverviewProps) {
  const totalStops = tasks.length;
  const completedStops = tasks.filter(t => t.status === 'DELIVERED' || !!t.report).length;
  const pendingStops = totalStops - completedStops;
  const totalJarsToDeliver = tasks.reduce((sum, t) => sum + (t.requiredQuantity || 0), 0);
  const totalJarsDelivered = tasks.reduce((sum, t) => {
    if (t.report?.partnerDeliveredQty !== undefined) {
      return sum + t.report.partnerDeliveredQty;
    }
    return t.status === 'DELIVERED' ? sum + (t.requiredQuantity || 0) : sum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Offline Queue Notice */}
      {offlineQueueCount > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{offlineQueueCount} offline report{offlineQueueCount > 1 ? 's' : ''}</strong> queued. Will sync automatically when connection restores.
            </span>
          </div>
          <button 
            onClick={onRefresh}
            className="text-xs font-semibold uppercase tracking-wider text-amber-700 hover:text-amber-900 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Operational Stats Bar - Clean inline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Assigned Stops</span>
            <Truck className="w-4 h-4 text-[#1677C8]" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{totalStops}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Total for today</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{pendingStops}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Remaining stops</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Completed</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{completedStops}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Delivered / logged</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Jars Handled</span>
            <Layers className="w-4 h-4 text-[#1677C8]" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">
            {totalJarsDelivered} <span className="text-xs font-normal text-[#64748B]">/ {totalJarsToDeliver}</span>
          </div>
          <div className="text-xs text-[#64748B] mt-0.5">Bottles scheduled</div>
        </div>
      </div>

      {/* Main Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-bold text-[#16324F]">Today's Route Schedule</h2>
          <p className="text-xs text-[#64748B]">Sequential list of assigned delivery drops</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1677C8] bg-blue-50/60 hover:bg-blue-100/60 border border-blue-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stops List */}
      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const isDelivered = task.status === 'DELIVERED';
            const hasReport = !!task.report;
            const customerName = task.customer?.user
              ? `${task.customer.user.firstName} ${task.customer.user.lastName}`
              : (task.customer?.companyName || 'Valued Customer');
            const fullAddress = [
              task.address?.houseName,
              task.address?.buildingName,
              task.address?.street,
              task.address?.area,
              task.address?.city,
              task.address?.zipCode
            ].filter(Boolean).join(', ');

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
                className={`bg-white border rounded-xl p-4 sm:p-5 transition-all ${
                  isDelivered || hasReport
                    ? 'border-emerald-100 bg-emerald-50/10' 
                    : 'border-[#E2E8F0] hover:border-blue-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isDelivered || hasReport
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-[#1677C8]/10 text-[#1677C8]'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#16324F]">{customerName}</h3>
                        {task.customer?.customerType && (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-[#64748B]">
                            {task.customer.customerType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#64748B] mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                        <span className="line-clamp-1">{fullAddress || 'Address on file'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isDelivered || hasReport
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : task.status === 'OUT_FOR_DELIVERY'
                        ? 'bg-blue-50 text-[#1677C8] border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isDelivered || hasReport ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{hasReport ? 'LOGGED' : task.status}</span>
                    </span>

                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-[#16324F] rounded-lg">
                      {task.requiredQuantity} {task.requiredQuantity === 1 ? 'Jar' : 'Jars'}
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                  <div className="flex items-center gap-2">
                    {fullAddress && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1677C8] bg-[#1677C8]/5 hover:bg-[#1677C8]/10 rounded-lg transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Navigate</span>
                      </a>
                    )}
                    {task.customer?.user?.phone && (
                      <a
                        href={`tel:${task.customer.user.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 rounded-lg transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>

                  <div>
                    {!hasReport && !isDelivered ? (
                      <button
                        onClick={() => onOpenReportModal(task)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-lg shadow-2xs transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Submit Delivery Log</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Delivered: {task.report?.partnerDeliveredQty ?? task.requiredQuantity} | Empty: {task.report?.partnerEmptyCollected ?? 0}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Operational Empty State */
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-[#1677C8] mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#16324F] mb-1">No deliveries assigned yet</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mb-5 leading-relaxed">
            When your delivery run is scheduled by operations staff, your stops, orders, and customer routing will appear here automatically.
          </p>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Check for Route Updates</span>
          </button>
        </div>
      )}
    </div>
  );
}
