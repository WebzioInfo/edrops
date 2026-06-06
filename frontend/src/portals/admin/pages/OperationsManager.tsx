import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { Warehouse, PackageCheck, AlertCircle, ArrowRightLeft } from 'lucide-react';

export default function OperationsManager() {
  const [activeTab, setActiveTab] = useState<'warehouses' | 'inventory'>('inventory');

  const { data: warehouses, isLoading: whLoading } = useQuery({
    queryKey: ['admin_warehouses'],
    queryFn: () => fetchWithAuth('/warehouse'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Operations Manager</h1>
          <p className="text-slate-500 font-semibold mt-1">Warehouse control and inventory tracking engine.</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Active Warehouses</p>
            <p className="text-2xl font-black text-slate-800">{warehouses?.length || 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Total Stock Value</p>
            <p className="text-2xl font-black text-slate-800">₹---</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-sm flex items-center gap-4 bg-rose-50/20">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Low Stock Alerts</p>
            <p className="text-2xl font-black text-rose-600">0</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="flex items-center gap-6 px-6 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-4 text-sm font-black transition-all border-b-2 ${
              activeTab === 'inventory' ? 'border-[#2D79A8] text-[#2D79A8]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Inventory Stock
          </button>
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`py-4 text-sm font-black transition-all border-b-2 ${
              activeTab === 'warehouses' ? 'border-[#2D79A8] text-[#2D79A8]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Warehouses & Locations
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'inventory' && (
            <div className="text-center py-10">
              <ArrowRightLeft className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-black text-slate-700">Inventory Engine Ready</h3>
              <p className="text-slate-500 font-medium max-w-md mx-auto mt-2">
                Stock movements will be tracked here. The backend Inventory Engine and transaction locks are deployed.
              </p>
            </div>
          )}

          {activeTab === 'warehouses' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {whLoading ? <p>Loading warehouses...</p> : warehouses?.map((wh: any) => (
                <div key={wh.id} className="border border-slate-100 p-5 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-slate-800 text-lg">{wh.name}</h3>
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${wh.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {wh.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300"></span> {wh.location}
                  </p>
                  <p className="text-xs font-bold text-slate-400 mt-2">Manager: {wh.managerName || 'Unassigned'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
