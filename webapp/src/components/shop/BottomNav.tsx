import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, CalendarHeart, Wallet, User } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function BottomNav() {
  const location = useLocation();

  const navItems = [
    { name: 'Home',   path: '/',              icon: Home },
    { name: 'Orders', path: '/orders',        icon: ShoppingBag },
    { name: 'Subs',   path: '/subscriptions', icon: CalendarHeart },
    { name: 'Wallet', path: '/wallet',        icon: Wallet },
    { name: 'Profile',path: '/profile',       icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 clay-bar z-40 sm:hidden">
      <ul className="flex items-center justify-around h-full px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <li key={item.name} className="flex-1">
              <Link
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground transition-all",
                  isActive && "text-primary"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "fill-primary/20")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
