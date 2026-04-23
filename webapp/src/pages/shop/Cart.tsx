import { Link, useNavigate } from 'react-router-dom';
import useCartStore from '../../store/useCartStore';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { Trash2, Plus, Minus, ArrowRight } from 'lucide-react';

export default function Cart() {
  const { items, updateQuantity, removeItem, cartTotal } = useCartStore();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-4 clay-card">
          <span className="text-4xl">🛒</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-xs">Looks like you haven't added any water to your cart yet.</p>
        <ClayButton onClick={() => navigate('/')}>Browse Products</ClayButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold ml-1">Shopping Cart</h2>
      
      <div className="space-y-4">
        {items.map((item) => (
          <ClayCard key={item.id} className="p-4 flex gap-4 items-center">
            <div className="w-20 h-20 bg-primary/5 rounded-xl flex-shrink-0">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm line-clamp-2">{item.name}</h3>
              <p className="text-primary font-bold mt-1">₹{item.price}</p>
              
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2 bg-background p-1 rounded-xl shadow-inner">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center bg-card rounded-lg active:scale-95 transition-transform"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-card rounded-lg active:scale-95 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg ml-auto transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </ClayCard>
        ))}
      </div>

      <ClayCard className="p-5 flex flex-col gap-4 mt-8">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">₹{cartTotal()}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Delivery Fee</span>
          <span className="text-green-600 font-medium">Free</span>
        </div>
        <div className="h-px bg-border w-full my-1"></div>
        <div className="flex justify-between items-center">
          <span className="font-bold text-lg">Total</span>
          <span className="font-bold text-xl text-primary">₹{cartTotal()}</span>
        </div>
        
        <ClayButton 
          className="w-full mt-2 group" 
          onClick={() => navigate('/checkout')}
        >
          Proceed to Checkout
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </ClayButton>
      </ClayCard>
    </div>
  );
}
