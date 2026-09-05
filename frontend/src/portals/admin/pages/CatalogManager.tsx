import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { 
  Plus, 
  Package, 
  Tag, 
  ShieldCheck, 
  Pencil, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Boxes
} from 'lucide-react';
import CatalogItemModal from '../components/CatalogItemModal';
import { useDialog } from '../../../hooks/useDialog';
import { DataErrorState } from '../../../components/common/DataErrorState';

type TabType = 'products' | 'categories' | 'brands';

export default function CatalogManager() {
  const queryClient = useQueryClient();
  const { confirm, toast } = useDialog();
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'name-asc'>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const {
    data: products,
    isLoading: prodLoading,
    isError: prodError,
    error: prodErr,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['admin_products'],
    queryFn: () => fetchWithAuth('/catalog/products'),
  });

  const {
    data: categories,
    isLoading: catLoading,
    isError: catError,
    error: catErr,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['admin_categories'],
    queryFn: () => fetchWithAuth('/catalog/categories'),
  });

  const {
    data: brands,
    isLoading: brandLoading,
    isError: brandError,
    error: brandErr,
    refetch: refetchBrands,
  } = useQuery({
    queryKey: ['admin_brands'],
    queryFn: () => fetchWithAuth('/catalog/brands'),
  });

  // Reset pagination and filters on tab switch
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedBrand('all');
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const endpoint = activeTab === 'products' ? '/catalog/products' : activeTab === 'categories' ? '/catalog/categories' : '/catalog/brands';
      const url = editingItem ? `${endpoint}/${editingItem.id}` : endpoint;
      const method = editingItem ? 'PATCH' : 'POST';

      const formData = new FormData();
      const forbiddenKeys = ['id', 'createdAt', 'updatedAt', 'brand', 'category', 'images', 'stock', 'status', '_count', 'imageUrl', 'logoUrl'];

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null && !forbiddenKeys.includes(key)) {
          if (key === 'depositAmount' && (data[key] === '' || isNaN(Number(data[key])))) {
            formData.append('depositAmount', '0');
          } else {
            formData.append(key, data[key]);
          }
        }
      });

      return fetchWithAuth(url, {
        method,
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`admin_${activeTab}`] });
      queryClient.invalidateQueries({ queryKey: ['shop_products'] });
      toast.success(`${editingItem ? 'Updated' : 'Created'} ${activeTab === 'products' ? 'product' : activeTab === 'categories' ? 'category' : 'brand'} successfully!`);
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save item. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      const endpoint = activeTab === 'products' ? '/catalog/products' : activeTab === 'categories' ? '/catalog/categories' : '/catalog/brands';
      return fetchWithAuth(`${endpoint}/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`admin_${activeTab}`] });
      toast.success(`${activeTab === 'products' ? 'Product' : activeTab === 'categories' ? 'Category' : 'Brand'} deleted successfully`);
    },
    onError: () => {
      toast.error('Failed to delete item');
    }
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Item',
      description: 'Are you sure you want to delete this item? This action is permanent.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });
    
    if (isConfirmed) {
      deleteMutation.mutate(id);
    }
  };

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    let list = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p: any) => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.brand?.name && p.brand.name.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((p: any) => p.categoryId === selectedCategory || p.category?.id === selectedCategory);
    }

    if (selectedBrand !== 'all') {
      list = list.filter((p: any) => p.brandId === selectedBrand || p.brand?.id === selectedBrand);
    }

    list.sort((a: any, b: any) => {
      if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [products, searchQuery, selectedCategory, selectedBrand, sortBy]);

  // Filter Categories
  const filteredCategories = useMemo(() => {
    if (!categories || !Array.isArray(categories)) return [];
    let list = [...categories];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) => c.name && c.name.toLowerCase().includes(q));
    }
    return list;
  }, [categories, searchQuery]);

  // Filter Brands
  const filteredBrands = useMemo(() => {
    if (!brands || !Array.isArray(brands)) return [];
    let list = [...brands];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((b: any) => b.name && b.name.toLowerCase().includes(q));
    }
    return list;
  }, [brands, searchQuery]);

  // Active list based on tab
  const totalItems = activeTab === 'products' 
    ? filteredProducts.length 
    : activeTab === 'categories' 
      ? filteredCategories.length 
      : filteredBrands.length;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'all' || selectedBrand !== 'all' || sortBy !== 'newest';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      
      {/* ─── 1. COMPACT PAGE HEADER ROW (48–56px) ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xs">
        {/* Left: Title + Breadcrumb + Subtitle */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#16324F] tracking-tight">
              Catalog Manager
            </h1>
            <span className="text-xs text-[#94A3B8]">/</span>
            <span className="text-xs font-semibold text-[#64748B] capitalize">
              {activeTab}
            </span>
          </div>

          <span className="hidden md:inline-block text-[11px] text-[#94A3B8] font-medium border-l border-slate-200 pl-2.5">
            Manage store products, categories & brand assets
          </span>
        </div>

        {/* Right: Add Item Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-[#1677C8] hover:bg-[#1262A5] text-white text-xs font-semibold px-3 py-1.5 sm:py-2 rounded-lg transition-colors shadow-2xs cursor-pointer active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New {activeTab === 'products' ? 'Product' : activeTab === 'categories' ? 'Category' : 'Brand'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. MAIN CARD: TABS + TOOLBAR + DATA TABLE ───────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden flex flex-col">
        
        {/* Compact Tab Bar (~40px) */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 border-b border-[#E2E8F0] bg-white overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('products')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'products' 
                  ? 'border-[#1677C8] text-[#1677C8]' 
                  : 'border-transparent text-[#64748B] hover:text-[#16324F] hover:border-slate-300'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products</span>
              {products && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'products' ? 'bg-[#1677C8]/10 text-[#1677C8]' : 'bg-slate-100 text-[#64748B]'
                }`}>
                  {products.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('categories')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'categories' 
                  ? 'border-[#1677C8] text-[#1677C8]' 
                  : 'border-transparent text-[#64748B] hover:text-[#16324F] hover:border-slate-300'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Categories</span>
              {categories && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'categories' ? 'bg-[#1677C8]/10 text-[#1677C8]' : 'bg-slate-100 text-[#64748B]'
                }`}>
                  {categories.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('brands')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'brands' 
                  ? 'border-[#1677C8] text-[#1677C8]' 
                  : 'border-transparent text-[#64748B] hover:text-[#16324F] hover:border-slate-300'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Brands</span>
              {brands && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'brands' ? 'bg-[#1677C8]/10 text-[#1677C8]' : 'bg-slate-100 text-[#64748B]'
                }`}>
                  {brands.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Compact Toolbar Row (Search, Filters, Sort) */}
        <div className="p-2.5 sm:p-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Search input */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#1677C8] transition-colors placeholder:text-[#94A3B8]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Filter & Sort Controls (shown on Products tab) */}
          {activeTab === 'products' && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#16324F] focus:outline-none focus:border-[#1677C8] transition-colors cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Brand Filter */}
              <div className="relative">
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#16324F] focus:outline-none focus:border-[#1677C8] transition-colors cursor-pointer"
                >
                  <option value="all">All Brands</option>
                  {brands?.map((brand: any) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>

              {/* Sort Order */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 font-medium text-[#16324F] focus:outline-none focus:border-[#1677C8] transition-colors cursor-pointer"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                </select>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 hover:bg-rose-50 rounded transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── TAB 1: PRODUCTS DENSE TABLE ───────────────────────── */}
        {activeTab === 'products' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC] z-10 border-b border-[#E2E8F0]">
                  <tr className="text-[#64748B] uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-2.5 px-3.5">Product</th>
                    <th className="py-2.5 px-3.5 hidden md:table-cell">Brand / Category</th>
                    <th className="py-2.5 px-3.5 text-right">Price</th>
                    <th className="py-2.5 px-3.5 text-right hidden md:table-cell">Deposit</th>
                    <th className="py-2.5 px-3.5 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#16324F]">
                  {prodLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="h-12">
                        <td colSpan={5} className="py-3 px-3.5">
                          <div className="h-5 bg-slate-100 animate-pulse rounded" />
                        </td>
                      </tr>
                    ))
                  ) : prodError ? (
                    <DataErrorState
                      isTableRow
                      colSpan={5}
                      title="Failed to load products"
                      message={(prodErr as any)?.message || 'Could not fetch products. Please try again.'}
                      onRetry={() => refetchProducts()}
                    />
                  ) : paginatedProducts.length > 0 ? (
                    paginatedProducts.map((p: any) => {
                      const imageUrl = p.images?.[0]?.url || p.imageUrl || null;
                      const isDepositRequired = Boolean(p.isJar && p.depositAmount > 0);

                      return (
                        <tr 
                          key={p.id} 
                          className="h-12 hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Product Info & Thumbnail */}
                          <td className="py-2 px-3.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex items-center justify-center shrink-0">
                                {imageUrl ? (
                                  <img 
                                    src={imageUrl} 
                                    alt={p.name}
                                    className="w-full h-full object-cover" 
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.parentElement?.querySelector('.prod-fallback');
                                      if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`prod-fallback flex items-center justify-center text-[#94A3B8] ${imageUrl ? 'hidden' : 'flex'}`}>
                                  <Package className="w-4 h-4 text-[#94A3B8]" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[#16324F] text-xs line-clamp-2 md:truncate max-w-[200px] sm:max-w-xs group-hover:text-[#1677C8] transition-colors">
                                  {p.name}
                                </p>
                                {p.description && (
                                  <p className="text-[11px] text-[#64748B] line-clamp-2 md:truncate max-w-[200px] sm:max-w-xs font-normal">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Brand / Category */}
                          <td className="py-2 px-3.5 hidden md:table-cell">
                            <div className="flex flex-col leading-tight">
                              <span className="font-semibold text-[#16324F] text-xs">
                                {p.brand?.name || '—'}
                              </span>
                              <span className="text-[11px] text-[#64748B]">
                                {p.category?.name || 'Uncategorized'}
                              </span>
                            </div>
                          </td>

                          {/* Price Column (Right-aligned) */}
                          <td className="py-2 px-3.5 text-right font-bold text-[#1677C8] text-xs">
                            ₹{p.price}
                          </td>

                          {/* Deposit Column (Right-aligned) */}
                          <td className="py-2 px-3.5 text-right hidden md:table-cell">
                            {isDepositRequired ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded text-[10px] font-bold">
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                                ₹{p.depositAmount}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal text-[11px]">None</span>
                            )}
                          </td>

                          {/* Actions Column (Tight 28x28px buttons) */}
                          <td className="py-2 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button"
                                onClick={() => handleEdit(p)} 
                                title="Edit Product"
                                className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDelete(p.id)} 
                                title="Delete Product"
                                className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-[#94A3B8] italic">
                        {hasActiveFilters 
                          ? 'No products found matching the selected filters.' 
                          : 'No products in catalog yet. Click "Add New Product" to create one.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Summary Footer Bar */}
            <div className="px-3.5 py-2.5 sm:px-4 border-t border-[#E2E8F0] bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-[#64748B] font-medium">
                Showing <span className="font-bold text-[#16324F]">{filteredProducts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-[#16324F]">{Math.min(currentPage * pageSize, filteredProducts.length)}</span> of <span className="font-bold text-[#16324F]">{filteredProducts.length}</span> products
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-semibold px-2 text-[#16324F]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 text-slate-500 hover:text-[#1677C8] hover:bg-slate-100 rounded border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: CATEGORIES DENSE GRID ──────────────────────── */}
        {activeTab === 'categories' && (
          <div className="p-3.5 sm:p-4">
            {catLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : catError ? (
              <DataErrorState
                title="Failed to load categories"
                message={(catErr as any)?.message || 'Could not fetch categories. Please try again.'}
                onRetry={() => refetchCategories()}
              />
            ) : filteredCategories.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredCategories.map((cat: any) => (
                  <div 
                    key={cat.id} 
                    className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-2.5 shadow-2xs hover:border-[#CBD5E1] transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-[#16324F] truncate group-hover:text-[#1677C8] transition-colors">
                          {cat.name}
                        </p>
                        <p className="text-[10px] text-[#64748B] font-medium">
                          {cat._count?.products ?? 0} Products
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleEdit(cat)} 
                        title="Edit Category"
                        className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDelete(cat.id)} 
                        title="Delete Category"
                        className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8] italic">
                {searchQuery ? 'No categories found matching your search.' : 'No categories created yet.'}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: BRANDS DENSE GRID ──────────────────────────── */}
        {activeTab === 'brands' && (
          <div className="p-3.5 sm:p-4">
            {brandLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : brandError ? (
              <DataErrorState
                title="Failed to load brands"
                message={(brandErr as any)?.message || 'Could not fetch brands. Please try again.'}
                onRetry={() => refetchBrands()}
              />
            ) : filteredBrands.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredBrands.map((brand: any) => (
                  <div 
                    key={brand.id} 
                    className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-2.5 shadow-2xs hover:border-[#CBD5E1] transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                        {brand.logoUrl ? (
                          <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="font-bold text-xs text-slate-500">
                            {brand.name?.[0]?.toUpperCase() || 'B'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-[#16324F] truncate group-hover:text-[#1677C8] transition-colors">
                          {brand.name}
                        </p>
                        <p className="text-[10px] text-[#64748B] font-medium">
                          {brand._count?.products ?? 0} Products
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        type="button"
                        onClick={() => handleEdit(brand)} 
                        title="Edit Brand"
                        className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#1677C8] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDelete(brand.id)} 
                        title="Delete Brand"
                        className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8] italic">
                {searchQuery ? 'No brands found matching your search.' : 'No brands created yet.'}
              </div>
            )}
          </div>
        )}

      </div>

      <CatalogItemModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        type={activeTab}
        onSubmit={(data) => createMutation.mutate(data)}
        initialData={editingItem}
        brands={brands}
        categories={categories}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
