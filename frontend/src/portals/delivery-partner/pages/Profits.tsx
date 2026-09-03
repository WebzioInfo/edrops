import { useMemo } from 'react';
import { 
  CheckCircle, 
  Layers, 
  RotateCcw, 
  TrendingUp, 
  Clock, 
  AlertCircle
} from 'lucide-react';
import type { DeliveryTask } from './Overview';

interface ProfitsProps {
  tasks: DeliveryTask[];
  loading?: boolean;
}

export default function Profits({ tasks }: ProfitsProps) {
  const stats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'DELIVERED' || !!t.report);
    const totalStops = tasks.length;
    const completedCount = completedTasks.length;
    const completionRate = totalStops > 0 ? Math.round((completedCount / totalStops) * 100) : 0;

    const bottlesDelivered = completedTasks.reduce((sum, t) => {
      if (t.report?.partnerDeliveredQty !== undefined) {
        return sum + t.report.partnerDeliveredQty;
      }
      return sum + (t.requiredQuantity || 0);
    }, 0);

    const emptyBottlesCollected = completedTasks.reduce((sum, t) => {
      return sum + (t.report?.partnerEmptyCollected || 0);
    }, 0);

    return {
      totalStops,
      completedCount,
      completionRate,
      bottlesDelivered,
      emptyBottlesCollected,
      completedTasks
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#16324F]">Profits</h1>
        <p className="text-xs sm:text-sm text-[#64748B]">Track your delivery earnings and performance</p>
      </div>

      {/* Metric Cards - Clean Operational Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Completed Stops</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{stats.completedCount}</div>
          <div className="text-xs text-[#64748B] mt-0.5">
            out of {stats.totalStops} assigned stops
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Bottles Delivered</span>
            <Layers className="w-4 h-4 text-[#1677C8]" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{stats.bottlesDelivered}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Water jars dropped</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Empty Returns</span>
            <RotateCcw className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-[#16324F]">{stats.emptyBottlesCollected}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Empty jars collected</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 sm:p-5 rounded-xl">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1">
            <span>Route Success</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.completionRate}%</div>
          <div className="text-xs text-[#64748B] mt-0.5">Completion efficiency</div>
        </div>
      </div>

      {/* Completed Runs Performance Log */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#16324F]">Delivery Performance Log</h2>
            <p className="text-xs text-[#64748B]">Verified and logged drops from your routes</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-[#64748B] rounded-lg">
            {stats.completedCount} Record{stats.completedCount !== 1 ? 's' : ''}
          </span>
        </div>

        {stats.completedTasks.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {stats.completedTasks.map((task) => {
              const customerName = task.customer?.user
                ? `${task.customer.user.firstName} ${task.customer.user.lastName}`
                : (task.customer?.companyName || 'Valued Customer');
              const address = [task.address?.street, task.address?.city].filter(Boolean).join(', ');
              const delivered = task.report?.partnerDeliveredQty ?? task.requiredQuantity;
              const empty = task.report?.partnerEmptyCollected ?? 0;

              return (
                <div key={task.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#16324F]">{customerName}</span>
                        <span className="text-[10px] font-mono text-[#64748B]">#{task.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5">{address || 'Delivery Address'}</p>
                      {task.report?.partnerNotes && (
                        <p className="text-xs text-gray-500 italic mt-0.5">"{task.report.partnerNotes}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:text-right shrink-0">
                    <div>
                      <span className="text-xs font-bold text-[#16324F]">
                        {delivered} Delivered / {empty} Empty
                      </span>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        {task.report ? 'Report Submitted' : 'Delivered'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-[#64748B] space-y-2">
            <Clock className="w-8 h-8 mx-auto text-gray-300" />
            <h3 className="text-sm font-bold text-[#16324F]">No completed deliveries yet</h3>
            <p className="text-xs max-w-sm mx-auto">
              As you complete customer deliveries and submit delivery reports on your route, your verified performance and unit statistics will populate here.
            </p>
          </div>
        )}
      </div>

      {/* Settlement Info Notice */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3 text-xs text-[#64748B]">
        <AlertCircle className="w-4 h-4 text-[#1677C8] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#16324F]">Settlement & Payout Policy:</strong> Delivery logs are reviewed and confirmed with warehouse stock reconciliation at the end of each shift. Earnings and route settlements are credited based on your registered partner agreement.
        </div>
      </div>
    </div>
  );
}
