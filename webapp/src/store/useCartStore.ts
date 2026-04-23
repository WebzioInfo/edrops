import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      // Action to add an item or increment its quantity if it already exists
      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.id === item.id);
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          // Default to quantity 1 if not provided
          return { items: [...state.items, { ...item, quantity: item.quantity || 1 }] };
        });
      },
      // Action to remove an item completely
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },
      // Action to update quantity
      updateQuantity: (id, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, quantity } : i
            ),
          };
        });
      },
      // Action to clear cart
      clearCart: () => set({ items: [] }),
      // Helper selector
      cartTotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
      cartCount: () => {
         return get().items.reduce((count, item) => count + item.quantity, 0);
      }
    }),
    {
      name: 'cart-storage',
    }
  )
);

export default useCartStore;
