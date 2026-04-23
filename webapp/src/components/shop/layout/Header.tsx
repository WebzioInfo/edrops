import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import useCartStore from '../../../store/useCartStore';

export default function Header() {
  const { cartCount } = useCartStore();
  const count = cartCount();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 clay-bar z-40 px-4 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-primary tracking-tight">
        E-Drops
      </Link>
      <Link to="/cart" className="relative p-2 rounded-full hover:bg-card-foreground/5 transition-colors">
        <ShoppingCart className="w-6 h-6 text-foreground" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
            {count}
          </span>
        )}
      </Link>
    </header>
  );
}
