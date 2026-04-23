import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { Package, Wallet, CalendarRange, LogOut, ChevronRight, User as UserIcon } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { icon: Package, label: 'My Orders', desc: 'View order history' },
    { icon: CalendarRange, label: 'Subscriptions', desc: 'Manage auto-deliveries' },
    { icon: Wallet, label: 'Wallet', desc: 'Balance: ₹0' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
          <UserIcon className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{user?.name || 'Guest User'}</h2>
          <p className="text-muted-foreground">+91 {user?.phone || '9876543210'}</p>
        </div>
      </div>

      <div className="space-y-4">
        {navItems.map((item, i) => (
          <ClayCard key={i} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-card-foreground/5 transition-colors">
            <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center shadow-sm">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{item.label}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </ClayCard>
        ))}
      </div>

      <ClayCard 
        className="p-4 flex items-center justify-between cursor-pointer border-destructive/20 border"
        onClick={handleLogout}
      >
        <span className="font-semibold text-destructive">Logout</span>
        <LogOut className="w-5 h-5 text-destructive" />
      </ClayCard>
    </div>
  );
}
