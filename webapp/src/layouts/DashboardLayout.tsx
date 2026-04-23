import * as React from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { Droplets, LayoutDashboard, LogOut, Menu, Navigation, Package, Settings, ShoppingCart, Users, Wallet, Warehouse, X, Ticket } from "lucide-react"
import { ClayContainer, ClayCard, ClayButton, cn } from "../components/ui/ClayComponents"

const SidebarItem = ({ icon: Icon, label, href, active }: { icon: any, label: string, href: string, active: boolean }) => (
  <Link 
    to={href}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? "clay-btn" 
        : "text-muted-foreground hover:bg-white/50 dark:hover:bg-black/20"
    }`}
  >
    <Icon size={20} />
    <span className="font-semibold">{label}</span>
  </Link>
)

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const location = useLocation()

  const menuItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/admin" },
    { icon: Wallet, label: "Finance", href: "/admin/finance" },
    { icon: Warehouse, label: "Godown", href: "/admin/godown" },
    { icon: Navigation, label: "Fleet", href: "/admin/fleet" },
    { icon: Package, label: "Products", href: "/admin/products" },
    { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
    { icon: Users, label: "Customers", href: "/admin/customers" },
    { icon: Droplets, label: "Subscriptions", href: "/admin/subscriptions" },
    { icon: Ticket, label: "Promos", href: "/admin/promos" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ]

  return (
    <ClayContainer className="flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-4 left-4 z-50 w-72 transition-transform duration-300 transform lg:translate-x-0 ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-[120%]"
      }`}>
        <ClayCard className="flex flex-col h-full py-8!">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
              <Droplets size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight">E-Drops</span>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => (
              <SidebarItem 
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={location.pathname === item.href}
              />
            ))}
          </nav>

          <div className="pt-6 mt-4">
            <ClayButton 
              variant="ghost" 
              className={cn(
                "w-full py-8 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.7)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3),inset_-4px_-4px_8px_rgba(255,255,255,0.1)] transition-all"
              )}
            >
              <LogOut size={20} />
              Logout
            </ClayButton>
          </div>
        </ClayCard>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-80 flex flex-col min-w-0 p-4 lg:p-4">
        <ClayCard className="h-20 sticky top-4 z-40 px-8 flex items-center justify-between py-4! shadow-sm mb-6">
          <ClayButton 
            variant="ghost" 
            className="lg:hidden p-2!"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </ClayButton>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Admin User</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">System Administrator</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </ClayCard>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </ClayContainer>
  )
}
