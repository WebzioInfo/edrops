import { 
  DollarSign, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Download,
  Calendar
} from "lucide-react"
import { ClayCard, ClayButton } from "../../components/ui/ClayComponents"

const TransactionRow = ({ id, user, amount, type, status, date }: {
  id: string, user: string, amount: string, type: string, status: string, date: string
}) => (
  <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
        type === 'CREDIT' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
      }`}>
        {type === 'CREDIT' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
      </div>
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">{user}</p>
        <p className="text-xs text-slate-500">{date} • {id}</p>
      </div>
    </div>
    <div className="text-right">
      <p className={`font-extrabold text-lg ${
        type === 'CREDIT' ? "text-emerald-600" : "text-slate-800 dark:text-white"
      }`}>
        {type === 'CREDIT' ? `+ ${amount}` : `- ${amount}`}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{status}</p>
    </div>
  </div>
)

export default function Finance() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight italic">Financial Overview</h1>
          <p className="text-slate-500 dark:text-slate-400">Track your revenue, wallets, and subscription payments.</p>
        </div>
        <div className="flex gap-3">
          <ClayButton variant="ghost" className="gap-2 text-primary font-bold">
            <Calendar size={18} />
            This Month
          </ClayButton>
          <ClayButton className="gap-2">
            <Download size={18} />
            Export Report
          </ClayButton>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <ClayCard className="bg-primary text-white overflow-hidden relative border-none">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <DollarSign size={80} />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-80 mb-2">Total Revenue</h2>
          <div className="text-3xl font-extrabold tracking-tight">₹ 4,82,950</div>
          <p className="text-xs mt-2 font-bold flex items-center gap-1">
            <ArrowUpRight size={14} /> +24% from last month
          </p>
        </ClayCard>

        <ClayCard className="border-none">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Wallet Deposits</h2>
          <div className="text-3xl font-extrabold">₹ 1,12,000</div>
          <p className="text-xs mt-2 text-slate-500 font-medium">84 unique customer recharges</p>
        </ClayCard>

        <ClayCard className="text-emerald-600 bg-emerald-50/50 border-none">
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-80 mb-2">Settled to Partners</h2>
          <div className="text-3xl font-extrabold tracking-tight">₹ 2,45,100</div>
          <p className="text-xs mt-2 flex items-center gap-1 font-bold">
            Automatic settlement active
          </p>
        </ClayCard>

        <ClayCard className="bg-slate-900 text-white border-none">
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">System Balance</h2>
          <div className="text-3xl font-extrabold">₹ 1,25,850</div>
          <p className="text-xs mt-2 text-slate-400">Net platform profit</p>
        </ClayCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ClayCard className="lg:col-span-2 border-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Transaction History</h2>
              <p className="text-sm text-muted-foreground">Recent payments and wallet recharges</p>
            </div>
            <ClayButton variant="ghost" className="text-primary font-bold">View All</ClayButton>
          </div>
          <div className="space-y-4">
            <TransactionRow id="TXN_77412" user="Rahul K." amount="₹ 500" type="CREDIT" status="SUCCESS" date="Today, 2:30 PM" />
            <TransactionRow id="TXN_77411" user="Anjali S." amount="₹ 160" type="DEBIT" status="SUCCESS" date="Today, 11:45 AM" />
            <TransactionRow id="TXN_77410" user="Vinod (Driver)" amount="₹ 8,400" type="DEBIT" status="SETTLED" date="Yesterday" />
            <TransactionRow id="TXN_77409" user="Suresh (Driver)" amount="₹ 12,200" type="DEBIT" status="SETTLED" date="Yesterday" />
          </div>
        </ClayCard>

        <ClayCard className="bg-indigo-600 text-white flex flex-col justify-between border-none">
          <div>
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <Wallet size={24} />
            </div>
            <h2 className="text-xl font-bold mb-1">Razorpay Integration</h2>
            <p className="text-indigo-100/70 text-sm mb-6">Automatic payment verification is active for all transactions.</p>
            <div className="pb-8">
              <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs uppercase font-bold opacity-60 tracking-wider">Settlement Mode</span>
                  <span className="text-[10px] bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                </div>
                <div className="text-lg font-bold">T+1 Managed</div>
                <p className="text-[10px] opacity-60 mt-1 italic">Funds are settled to Godown accounts within 24 hours.</p>
              </div>
            </div>
          </div>
          <ClayButton variant="ghost" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 border">
            Payment Settings
          </ClayButton>
        </ClayCard>
      </div>
    </div>
  )
}
