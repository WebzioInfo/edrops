import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';
import { useRequireAuth } from '../../../hooks/useRequireAuth';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PullToRefresh from '../../../components/pwa/PullToRefresh';
import ProductCard from '../components/ProductCard';

export default function Shop() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { requireAuth } = useRequireAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem('edrops_banner_closed') !== 'true';
  });

  const handleCloseBanner = () => {
    setShowBanner(false);
    localStorage.setItem('edrops_banner_closed', 'true');
  };

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchWithAuth('/catalog/categories'),
  });

  const { data: products, isLoading: prodLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', selectedCategory, search],
    queryFn: () => {
      let url = '/catalog/products?';
      if (selectedCategory) url += `categoryId=${selectedCategory}&`;
      if (search) url += `search=${search}`;
      return fetchWithAuth(url);
    },
  });

  const handleRefresh = async () => {
    await Promise.all([
      refetchProducts(),
      refetchCategories(),
    ]);
  };

  const handleAddToCart = (product: any) => {
    requireAuth(
      () => {
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
      },
      { redirect: '/customer/shop', reason: 'cart' }
    );
  };

  const handleBuyNow = (product: any) => {
    const buyNowUrl = `/customer/checkout?buyNow=true&productId=${product.id}&quantity=1&name=${encodeURIComponent(product.name)}&price=${product.price}&imageUrl=${encodeURIComponent(product.images?.[0]?.url || '')}&brandName=${encodeURIComponent(product.brand?.name || '')}`;
    requireAuth(
      () => {
        navigate(buyNowUrl);
      },
      { redirect: buyNowUrl, reason: 'purchase' }
    );
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8 bg-[#F8FAFC] min-h-screen">
      
      {/* Hero Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.section
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.95, height: 0, margin: 0, padding: 0 }}
            className="relative overflow-hidden p-4 sm:p-8 bg-[#EBF5FB] rounded-2xl mb-4 sm:mb-6 border border-[#BBDFF2]"
          >
            <button
              onClick={handleCloseBanner}
              className="absolute top-3 right-3 z-20 p-1.5 bg-white/60 hover:bg-white rounded-full text-[#64748B] hover:text-[#0F172A] transition-colors shadow-xs cursor-pointer"
              aria-label="Close banner"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative z-10 max-w-xl pr-6">
              <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold text-[#0F172A] leading-snug">
                Fresh water, <span className="text-[#1E88E5]">delivered instantly.</span>
              </h1>
              <p className="mt-1.5 text-xs sm:text-[14px] font-medium text-[#64748B]">
                Welcome{user?.firstName ? `, ${user.firstName}` : ' to Edrops'}. Browse our premium brands and request a delivery in seconds.
              </p>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10 hidden md:block z-0 pointer-events-none">
              <ShoppingCart className="w-48 h-48 text-[#1E88E5]" />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Categories & Search Toolbar */}
      <section className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-4 sm:mb-6">
        {/* Desktop Category Chips */}
        <div className="hidden md:flex w-full md:w-auto gap-2 overflow-x-auto whitespace-nowrap no-scrollbar md:mx-0 md:px-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 flex items-center justify-center h-[38px] px-4 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
              selectedCategory === null
                ? 'bg-[#1E88E5] text-white shadow-xs'
                : 'bg-white text-[#1E88E5] border border-[#E2E8F0]'
            }`}
          >
            All Products
          </button>
          {categories?.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 flex items-center justify-center h-[38px] px-4 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1E88E5] text-white shadow-xs'
                  : 'bg-white text-[#1E88E5] border border-[#E2E8F0]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Mobile Category Dropdown */}
        <div className="md:hidden w-full relative">
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value === '' ? null : e.target.value)}
            className="w-full h-[42px] pl-3.5 pr-10 rounded-xl border border-[#E2E8F0] bg-white shadow-xs focus:border-[#1E88E5] focus:outline-none focus:ring-1 focus:ring-[#1E88E5] appearance-none text-[13px] font-medium text-[#0F172A]"
          >
            <option value="">All Products</option>
            {categories?.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#64748B]">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        <div className="relative w-full md:w-80 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[#64748B]" />
          </div>
          <input
            type="text"
            placeholder="Search water brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 h-[42px] rounded-xl border border-[#E2E8F0] bg-white shadow-xs focus:border-[#1E88E5] focus:outline-none focus:ring-1 focus:ring-[#1E88E5] transition-all text-[13px] text-[#0F172A] placeholder:text-[#64748B]"
          />
        </div>
      </section>

      {/* Responsive Dense Product Grid */}
      <section>
        {prodLoading ? (
          <div className="flex justify-center py-20 w-full">
            <LoadingSpinner size="md" label="Loading catalog..." />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4 lg:gap-5 w-full">
            {products?.map((product: any, idx: number) => (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                key={product.id}
                className="h-full w-full"
              >
                <ProductCard
                  product={product}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                />
              </motion.div>
            ))}

            {products?.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <p className="text-[#64748B] font-medium text-[15px]">No products found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
    </PullToRefresh>
  );
}
