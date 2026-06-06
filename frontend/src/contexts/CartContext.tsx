import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchWithAuth } from '../api/client';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isJar: boolean;
  depositAmount: number;
  imageUrl?: string;
  brandName?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subTotal: number;
  depositTotal: number;
  deliveryCharge: number;
  grandTotal: number;
  returnEmptyJars: boolean;
  setReturnEmptyJars: (val: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  
  const [returnEmptyJars, setReturnEmptyJars] = useState<boolean>(() => {
    const saved = localStorage.getItem('edrops_return_jars');
    return saved ? JSON.parse(saved) : false;
  });

  const loadCart = async () => {
    try {
      const cart = await fetchWithAuth('/cart');
      if (cart && cart.items) {
        const formattedItems = cart.items.map((i: any) => ({
          id: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
          isJar: i.product.categoryId === 'water-jars' || !!i.product.depositAmount,
          depositAmount: i.product.depositAmount || 0,
          imageUrl: i.product.images?.[0]?.url,
          brandName: i.product.brand?.name,
        }));
        setItems(formattedItems);
      }
    } catch (e) {
      console.error('Failed to load cart', e);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('edrops_token')) {
      loadCart();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('edrops_return_jars', JSON.stringify(returnEmptyJars));
  }, [returnEmptyJars]);

  const addItem = async (newItem: Omit<CartItem, 'quantity'>) => {
    // Optimistic UI update
    setItems((current) => {
      const existing = current.find(item => item.id === newItem.id);
      if (existing) {
        return current.map(item => item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { ...newItem, quantity: 1 }];
    });
    
    try {
      const existing = items.find(i => i.id === newItem.id);
      const newQuantity = existing ? existing.quantity + 1 : 1;
      await fetchWithAuth('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: newItem.id, quantity: newQuantity })
      });
    } catch (e) {
      loadCart(); // Rollback on failure
    }
  };

  const removeItem = async (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
    try {
      await fetchWithAuth(`/cart/items/${id}`, { method: 'DELETE' });
    } catch (e) {
      loadCart();
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) {
      return removeItem(id);
    }
    setItems(current => current.map(item => item.id === id ? { ...item, quantity } : item));
    try {
      await fetchWithAuth('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: id, quantity })
      });
    } catch (e) {
      loadCart();
    }
  };

  const clearCart = async () => {
    setItems([]);
    try {
      await fetchWithAuth('/cart', { method: 'DELETE' });
    } catch (e) {
      loadCart();
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const depositTotal = returnEmptyJars ? 0 : items.reduce((sum, item) => sum + (item.depositAmount * item.quantity), 0);
  const deliveryCharge = items.length > 0 ? (subTotal > 500 ? 0 : 50) : 0;
  const grandTotal = subTotal + depositTotal + deliveryCharge;

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      totalItems, subTotal, depositTotal, deliveryCharge, grandTotal,
      returnEmptyJars, setReturnEmptyJars
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
