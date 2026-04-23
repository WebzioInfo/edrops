import { Shield, Smartphone, Server } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"

export default function Settings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-extrabold tracking-tight">System Configuration</h1>
        <p className="text-slate-500 dark:text-slate-400">Platform preferences, integrations, and global security bounds.</p>
      </div>

      <div className="space-y-6">
        <ClayCard className="border-none p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Server size={20} /></div>
            <h2 className="text-xl font-bold">Platform Defaults</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Platform Name</label>
                <ClayInput defaultValue="E-Drops Central" />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Support Email</label>
                <ClayInput defaultValue="admin@edrops.in" type="email" />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Jar Deposit Amount (₹)</label>
                <ClayInput defaultValue="150" type="number" />
             </div>
          </div>
          <div className="mt-6 flex justify-end">
             <ClayButton>Save Options</ClayButton>
          </div>
        </ClayCard>

        <ClayCard className="border-none p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Smartphone size={20} /></div>
            <h2 className="text-xl font-bold">Mobile App Config</h2>
          </div>
          
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                   <h3 className="font-bold">Force App Update</h3>
                   <p className="text-xs text-slate-500 mt-1">Requires user to upgrade Customer & Delivery clients before logging in.</p>
                </div>
                <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative cursor-pointer shadow-inner">
                   <div className="absolute top-1 left-1 h-4 w-4 bg-white rounded-full transition-transform" />
                </div>
             </div>
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                   <h3 className="font-bold">Allow Freelance Registrations</h3>
                   <p className="text-xs text-slate-500 mt-1">Open public endpoint for Delivery partners onboarding via OTP.</p>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer shadow-inner">
                   <div className="absolute top-1 left-7 h-4 w-4 bg-white rounded-full transition-transform" />
                </div>
             </div>
          </div>
        </ClayCard>

        <ClayCard className="border-none p-6 border-rose-100">
          <div className="flex items-center gap-3 border-b border-rose-100/50 dark:border-rose-900/30 pb-4 mb-6">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><Shield size={20} /></div>
            <h2 className="text-xl font-bold text-rose-600">Danger Zone</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
             <div>
                <h3 className="font-bold">Purge System Data</h3>
                <p className="text-xs text-slate-500 mt-1">Irreversibly cleans all records. Sandbox mode only.</p>
             </div>
             <ClayButton variant="ghost" className="border border-rose-200 text-rose-600 hover:bg-rose-50 px-8">Factory Reset</ClayButton>
          </div>
        </ClayCard>

      </div>
    </div>
  )
}
