import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, X, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';

export default function Shop() {
  const { user } = useAuth();
  const { addItem } = useCart();
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

  const handleBuyNow = (product: any) => {
    navigate(`/customer/checkout?buyNow=true&productId=${product.id}&quantity=1&name=${encodeURIComponent(product.name)}&price=${product.price}&imageUrl=${encodeURIComponent(product.images[0]?.url || '')}&brandName=${encodeURIComponent(product.brand?.name || '')}`);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 bg-[#F8FAFC] min-h-screen">
      
      {/* Hero Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.section
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.95, height: 0, margin: 0, padding: 0 }}
            className="relative overflow-hidden p-6 sm:p-10 bg-[#EBF5FB] rounded-[24px] mb-8 border border-[#BBDFF2]"
          >
            <button
              onClick={handleCloseBanner}
              className="absolute top-4 right-4 z-20 p-2 bg-white/50 hover:bg-white rounded-full text-[#64748B] hover:text-[#0F172A] transition-colors shadow-sm cursor-pointer"
              aria-label="Close banner"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative z-10 max-w-xl">
              <h1 className="text-3xl sm:text-[32px] font-bold text-[#0F172A] leading-tight">
                Fresh water, <br /><span className="text-[#1E88E5]">delivered instantly.</span>
              </h1>
              <p className="mt-4 text-[14px] font-medium text-[#64748B]">
                Welcome back, {user?.firstName}. Browse our premium brands and request a delivery in seconds. No subscriptions required.
              </p>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 hidden md:block z-0 pointer-events-none">
              <ShoppingCart className="w-64 h-64 text-[#1E88E5]" />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Categories & Search Toolbar */}
      <section className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
        {/* Desktop Category Chips */}
        <div className="hidden md:flex w-full md:w-auto gap-[12px] overflow-x-auto whitespace-nowrap no-scrollbar md:mx-0 md:px-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 flex items-center justify-center min-h-[44px] px-[18px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
              selectedCategory === null
                ? 'bg-[#1E88E5] text-white shadow-sm'
                : 'bg-white text-[#1E88E5] border border-[#E2E8F0]'
            }`}
          >
            All Products
          </button>
          {categories?.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 flex items-center justify-center min-h-[44px] px-[18px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1E88E5] text-white shadow-sm'
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
            className="w-full h-[48px] pl-4 pr-10 rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm focus:border-[#1E88E5] focus:outline-none focus:ring-1 focus:ring-[#1E88E5] appearance-none text-[14px] font-medium text-[#0F172A]"
          >
            <option value="">All Products</option>
            {categories?.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#64748B]">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>

        <div className="relative w-full md:w-80 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#64748B]" />
          </div>
          <input
            type="text"
            placeholder="Search water brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 h-[48px] rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm focus:border-[#1E88E5] focus:outline-none focus:ring-1 focus:ring-[#1E88E5] transition-all text-[14px] text-[#0F172A] placeholder:text-[#64748B]"
          />
        </div>
      </section>

      {/* Product Grid */}
      <section>
        {prodLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-10 w-10 border-4 border-[#E2E8F0] border-t-[#1E88E5] rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 lg:grid-cols-3 gap-6">
            {products?.map((product: any, idx: number) => (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={product.id}
                className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm p-4 flex flex-col hover:-translate-y-1 transition-transform duration-300 relative group"
              >
                
                {/* Product Image Area */}
                <div className="h-[220px] rounded-[16px] bg-[#F8FAFC] mb-4 overflow-hidden flex items-center justify-center relative">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0].url} alt={product.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="text-[#64748B] text-[14px] font-medium flex items-center justify-center h-full">No Image</div>
                  )}
                  {/* Brand badge */}
                  <div className="absolute top-3 left-3 bg-[#EBF5FB] text-[#1E88E5] text-[12px] font-semibold px-3 py-1 rounded-full border border-[#BBDFF2]">
                    {product.brand?.name}
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 px-1">
                  <h3 className="text-[18px] font-bold text-[#0F172A] truncate" title={product.name}>{product.name}</h3>
                  <p className="text-[14px] font-medium text-[#64748B] mt-1 line-clamp-2 min-h-[40px] leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Pricing Area */}
                <div className="mt-5 px-1 flex flex-col gap-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[28px] font-bold text-[#1E88E5]">₹{product.price}</span>
                    <span className="text-[14px] font-medium text-[#64748B]">Per Jar</span>
                  </div>
                  {product.isJar && (
                    <div className="flex items-center gap-1.5 text-[#64748B] text-[12px] font-medium bg-[#F8FAFC] px-2 py-1 rounded-md self-start border border-[#E2E8F0]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#42A5F5]" />
                      Security Deposit ₹{product.depositAmount}
                    </div>
                  )}
                </div>

                {/* Actions Area */}
                <div className="mt-5 pt-5 border-t border-[#E2E8F0] grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleBuyNow(product)}
                    className="min-h-[44px] rounded-xl bg-white text-[#1E88E5] border border-[#1E88E5] font-semibold text-[14px] flex items-center justify-center hover:bg-[#EBF5FB] transition-colors cursor-pointer"
                  >
                    Buy Now
                  </button>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="min-h-[44px] rounded-xl bg-[#1E88E5] text-white border border-[#1E88E5] font-semibold text-[14px] flex items-center justify-center hover:bg-[#1565C0] transition-colors shadow-sm cursor-pointer"
                  >
                    Add to Cart
                  </button>
                </div>
              </motion.div>
            ))}

            {products?.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-[#64748B] font-medium text-[18px]">No products found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
