import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TrackPage from '../../customer/pages/Track';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center gap-4 border-b border-border/50 pb-6">
        <button 
          onClick={() => navigate('/admin/customers')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Customer Delivery Tracker</h1>
          <p className="text-sm font-semibold text-slate-500">Manage delivery schedules and status updates for this customer.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        {/* We embed the customer Track page but pass isAdmin and customerId */}
        <TrackPage isAdmin={true} customerId={id} />
      </div>
    </div>
  );
}
