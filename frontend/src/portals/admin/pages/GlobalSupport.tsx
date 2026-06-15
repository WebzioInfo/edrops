import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { LayoutDashboard, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import SupportManagement from '../../staff/pages/SupportManagement';

export default function GlobalSupport() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const data = await fetchWithAuth('/admin/support/analytics');
        setAnalytics(data);
      } catch (err) {
        toast.error('Failed to load support analytics');
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Support Analytics...</div>;
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="p-4 sm:p-6 pb-0">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Global Support Dashboard</h1>
        <p className="text-sm text-slate-500">Analytics and full system management for all support tickets</p>
      </div>

      {/* Analytics Cards */}
      <div className="px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Total Tickets</p>
            <p className="text-2xl font-black text-slate-900">{analytics?.totalTickets || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Open Tickets</p>
            <p className="text-2xl font-black text-slate-900">{analytics?.openTickets || 0}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">SLA Breached</p>
            <p className="text-2xl font-black text-slate-900">{analytics?.overdueTickets || 0}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Resolved Today</p>
            <p className="text-2xl font-black text-slate-900">{analytics?.resolvedToday || 0}</p>
          </div>
        </div>
      </div>

      {/* Embedded Support Management */}
      <div className="h-[800px] border-t border-slate-200 pt-4 relative bg-slate-50/50 rounded-b-[20px] overflow-hidden">
        <SupportManagement />
      </div>
    </div>
  );
}
