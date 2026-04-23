import { CheckCircle, AlertCircle, Clock, Search } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"
import { useState } from "react"

const SettlementRow = ({ partner, amount, date, status, onVerify }: {
  partner: string, amount: string, date: string, status: 'PENDING' | 'VERIFIED', onVerify?: () => void
}) => (
  <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all duration-300 group">
    <div className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
        status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
      }`}>
        {status === 'VERIFIED' ? <CheckCircle size={20} /> : <Clock size={20} />}
      </div>
      <div>
        <h4 className="font-bold text-slate-800 dark:text-slate-100">{partner}</h4>
        <p className="text-xs text-slate-500 font-medium">{date}</p>
      </div>
    </div>
    
    <div className="flex items-center gap-8">
      <div className="text-right">
        <p className="text-lg font-bold text-slate-900 dark:text-white">₹ {amount}</p>
        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${
          status === 'VERIFIED' ? 'text-emerald-500' : 'text-amber-500'
        }`}>
          {status}
        </p>
      </div>
      
      {status === 'PENDING' && (
        <ClayButton 
          onClick={onVerify}
          className="px-6 py-2"
        >
          Verify Settlement
        </ClayButton>
      )}
    </div>
  </div>
)

export default function Settlements() {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'VERIFIED'>('PENDING')
  
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            Financial Settlements
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Verify daily COD collections from delivery partners.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('PENDING')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeTab === 'PENDING' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'
            }`}
          >
            Pending
          </button>
          <button 
            onClick={() => setActiveTab('VERIFIED')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${
              activeTab === 'VERIFIED' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'
            }`}
          >
            Verified
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ClayCard className="border-none bg-linear-to-br from-primary/10 to-transparent">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary/70 mb-2">Unverified Cash</h2>
          <p className="text-4xl font-black">₹ 14,850</p>
          <p className="text-xs text-primary font-bold mt-2 flex items-center gap-1">
            <AlertCircle size={14} /> 12 Pending Verifications
          </p>
        </ClayCard>
        
        <ClayCard className="border-none">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Verified Today</h2>
          <p className="text-4xl font-black">₹ 42,320</p>
        </ClayCard>
        
        <ClayCard className="border-none">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Total Month</h2>
          <p className="text-4xl font-black">₹ 8,42,150</p>
        </ClayCard>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <ClayInput 
            type="text"
            placeholder="Search by partner name..."
            className="pl-12"
          />
        </div>
        
        <div className="space-y-4">
          {activeTab === 'PENDING' ? (
            <>
              <SettlementRow partner="Suresh Babu" amount="4,250" date="Today, 02:30 PM" status="PENDING" />
              <SettlementRow partner="Rahul K." amount="2,100" date="Today, 01:15 PM" status="PENDING" />
              <SettlementRow partner="Anil Kumar" amount="8,500" date="Yesterday" status="PENDING" />
            </>
          ) : (
            <>
              <SettlementRow partner="Vijayan" amount="1,800" date="Yesterday" status="VERIFIED" />
              <SettlementRow partner="Suresh Babu" amount="3,400" date="2 days ago" status="VERIFIED" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
