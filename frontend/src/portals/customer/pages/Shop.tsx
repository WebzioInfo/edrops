import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { useRequireAuth } from '../../../hooks/useRequireAuth';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PullToRefresh from '../../../components/pwa/PullToRefresh';
import ProductCard from '../components/ProductCard';
import DeliveryAvailabilityChecker from '../components/DeliveryAvailabilityChecker';

export default function Shop() {
  const { requireAuth } = useRequireAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    await Promise.all([refetchProducts(), refetchCategories()]);
  };

  const handleBuyNow = (product: any) => {
    const buyNowUrl = `/customer/checkout?buyNow=true&productId=${product.id}&quantity=1&name=${encodeURIComponent(
      product.name
    )}&price=${product.price}&imageUrl=${encodeURIComponent(
      product.images?.[0]?.url || ''
    )}&brandName=${encodeURIComponent(product.brand?.name || '')}&isJar=${Boolean(
      product.isJar
    )}&depositAmount=${product.depositAmount || 0}&brandId=${encodeURIComponent(
      product.brandId || product.brand?.id || ''
    )}`;
    requireAuth(
      () => {
        navigate(buyNowUrl);
      },
      { redirect: buyNowUrl, reason: 'purchase' }
    );
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-[#F8FAFC] min-h-screen">
        
        {/* Delivery Availability Checker */}
        <DeliveryAvailabilityChecker />

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
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#64748B]">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
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
        <section className="w-full">
          {prodLoading ? (
            <div className="flex justify-center items-center py-24 w-full">
              <LoadingSpinner size="md" label="Loading catalog..." />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 w-full">
              {products?.map((product: any, idx: number) => (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  key={product.id}
                  className="h-full w-full flex"
                >
                  <ProductCard product={product} onBuyNow={handleBuyNow} />
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
