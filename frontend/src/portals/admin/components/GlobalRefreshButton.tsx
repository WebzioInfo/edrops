import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export interface GlobalRefreshButtonProps {
  compact?: boolean;
  className?: string;
}

export function GlobalRefreshButton({ compact = false, className = '' }: GlobalRefreshButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/admin/system/global-refresh', {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Live sync broadcast sent: All portals refreshed!');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Failed to trigger global refresh');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error triggering refresh');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 ${
        compact ? 'p-1.5' : 'px-3 py-1.5'
      } ${className}`}
      title="Global Refresh: Instantly sync all customers, distributors, and staff"
    >
      <RefreshCw className={`w-3.5 h-3.5 text-[#1677C8] ${loading ? 'animate-spin' : ''}`} />
      {!compact && <span>Global Refresh</span>}
    </button>
  );
}

export default GlobalRefreshButton;
