import { Wallet, ShieldCheck, ArrowRightLeft, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';

export default function FinanceLedger() {
  const [activeTab, setActiveTab] = useState<'deposits' | 'wallets'>('deposits');

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['adminLedger'],
    queryFn: () => fetchWithAuth('/wallet/admin/ledger')
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Finance & Ledgers</h1>
          <p className="text-slate-500 font-semibold mt-1">Manage dual-wallet balances and security deposit refunds.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-500">Total Recharge Balances</p>
          <p className="text-2xl font-black text-slate-800">
            {isLoading ? '...' : `₹${ledger?.totalRechargeBalances ?? 0}`}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-500">Total Deposits Held</p>
          <p className="text-2xl font-black text-slate-800">
            {isLoading ? '...' : `₹${ledger?.totalDepositsHeld ?? 0}`}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-500">Deposits Refunded</p>
          <p className="text-2xl font-black text-slate-800">
            {isLoading ? '...' : `₹${ledger?.depositsRefunded ?? 0}`}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
            <CreditCard className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-500">Pending Settlements</p>
          <p className="text-2xl font-black text-slate-800">
             {isLoading ? '...' : `₹${ledger?.pendingSettlements ?? 0}`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 overflow-hidden">
        <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
          <button 
            onClick={() => setActiveTab('deposits')}
            className={`font-black transition-all ${activeTab === 'deposits' ? 'text-[#2D79A8]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Deposit Ledger
          </button>
          <button 
            onClick={() => setActiveTab('wallets')}
            className={`font-black transition-all ${activeTab === 'wallets' ? 'text-[#2D79A8]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Recharge Wallets
          </button>
        </div>

        <div className="text-center py-20">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-slate-700">Financial Ledger Engine Active</h3>
          <p className="text-slate-500 font-medium max-w-md mx-auto mt-2">
            Ledger statistics are now loading live from the database. Detailed transaction tables will be available in the next iteration.
          </p>
        </div>
      </div>
    </div>
  );
}
