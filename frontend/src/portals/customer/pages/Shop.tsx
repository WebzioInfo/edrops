import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingCart, Search, Plus, Tag } from 'lucide-react';
import { useState } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';

export default function Shop() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchWithAuth('/catalog/categories'),
  });

  const { data: products, isLoading: prodLoading } = useQuery({
    queryKey: ['products', selectedCategory, search],
    queryFn: () => {
      let url = '/catalog/products?';
      if (selectedCategory) url += `categoryId=${selectedCategory}&`;
      if (search) url += `search=${search}`;
      return fetchWithAuth(url);
    },
  });

  const handleAddToCart = (product: any) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      isJar: product.isJar,
      depositAmount: product.depositAmount,
      imageUrl: product.images?.[0]?.url,
      brandName: product.brand?.name,
    });
    toast.success(`Added ${product.name} to cart!`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 space-y-8">
      {/* Hero Banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay-card relative overflow-hidden p-6 sm:p-10 bg-gradient-to-br from-[#2D79A8]/10 to-emerald-500/10"
      >
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
            Fresh water, <br /><span className="text-[#2D79A8]">delivered instantly.</span>
          </h1>
          <p className="mt-4 text-base font-semibold text-slate-600">
            Welcome to Edrops, {user?.firstName}. Browse our premium brands and request a delivery in seconds. No subscriptions required.
          </p>
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-20 hidden md:block">
          <ShoppingCart className="w-96 h-96 text-[#2D79A8]" />
        </div>
      </motion.section>

      {/* Categories & Search */}
      <section className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-black transition-all ${selectedCategory === null
              ? 'bg-[#2D79A8] text-white shadow-lg shadow-[#2D79A8]/30'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
          >
            All Products
          </button>
          {categories?.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-black transition-all ${selectedCategory === cat.id
                ? 'bg-[#2D79A8] text-white shadow-lg shadow-[#2D79A8]/30'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search water brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-full border border-slate-200 bg-white shadow-sm focus:border-[#2D79A8] focus:ring-2 focus:ring-[#2D79A8]/20 transition-all font-medium text-sm"
          />
        </div>
      </section>

      {/* Product Grid */}
      <section>
        {prodLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-pulse flex h-14 w-14 items-center justify-center rounded-full water-gradient shadow-2xl shadow-edrops-aqua/30" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products?.map((product: any, idx: number) => (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={product.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-5 flex flex-col group hover:-translate-y-1 transition-all duration-300 relative"
              >
                {product.isJar && (
                  <div className="absolute top-4 right-4 z-10 bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Tag className="w-3 h-3" />
                    +₹{product.depositAmount} Deposit
                  </div>
                )}

                <div className="h-48 rounded-2xl bg-slate-50 mb-4 overflow-hidden flex items-center justify-center relative">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0].url} alt={product.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="text-slate-300 font-black flex items-center justify-center h-full">No Image</div>
                  )}
                  {/* Brand badge */}
                  <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-black px-3 py-1.5 rounded-full shadow-sm text-slate-700">
                    {product.brand?.name}
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-800 line-clamp-1">{product.name}</h3>
                  <p className="text-sm font-semibold text-slate-500 mt-1 line-clamp-2 min-h-[40px]">{product.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-[#2D79A8]">₹{product.price}</span>
                    {product.isJar && <span className="text-[10px] font-bold text-slate-400">Excl. Deposit</span>}
                  </div>

                  <button
                    onClick={() => handleAddToCart(product)}
                    className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 hover:bg-[#2D79A8] hover:shadow-[#2D79A8]/30 transition-all active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </motion.div>
            ))}

            {products?.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-slate-500 font-bold text-lg">No products found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
