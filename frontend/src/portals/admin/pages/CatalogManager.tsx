import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { Plus, Package, Tag, ShieldCheck, Pencil, Trash2 } from 'lucide-react';
import CatalogItemModal from '../components/CatalogItemModal';

export default function CatalogManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'brands'>('products');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: products, isLoading: prodLoading } = useQuery({
    queryKey: ['admin_products'],
    queryFn: () => fetchWithAuth('/catalog/products'),
  });

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ['admin_categories'],
    queryFn: () => fetchWithAuth('/catalog/categories'),
  });

  const { data: brands, isLoading: brandLoading } = useQuery({
    queryKey: ['admin_brands'],
    queryFn: () => fetchWithAuth('/catalog/brands'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const endpoint = activeTab === 'products' ? '/catalog/products' : activeTab === 'categories' ? '/catalog/categories' : '/catalog/brands';
      const url = editingItem ? `${endpoint}/${editingItem.id}` : endpoint;
      const method = editingItem ? 'PATCH' : 'POST';

      const formData = new FormData();
      const forbiddenKeys = ['id', 'createdAt', 'updatedAt', 'brand', 'category', 'images', 'stock', 'status', '_count', 'imageUrl', 'logoUrl'];

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null && !forbiddenKeys.includes(key)) {
          formData.append(key, data[key]);
        }
      });

      return fetchWithAuth(url, {
        method,
        body: formData,
        // Don't set Content-Type header manually when using FormData, browser will set it with boundary
      }, false); // Assumes fetchWithAuth can handle FormData if we pass a third param or if it doesn't hardcode headers. Wait, fetchWithAuth usually hardcodes application/json.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`admin_${activeTab}`] });
      setIsModalOpen(false);
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      const endpoint = activeTab === 'products' ? '/catalog/products' : activeTab === 'categories' ? '/catalog/categories' : '/catalog/brands';
      return fetchWithAuth(`${endpoint}/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`admin_${activeTab}`] });
    },
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Catalog Manager</h1>
          <p className="text-slate-500 font-semibold mt-1">Manage your marketplace products, brands, and categories.</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#245361] hover:bg-[#245361]/90 text-white px-5 py-2.5 rounded-full font-black shadow-lg shadow-[#245361]/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add New {activeTab === 'products' ? 'Product' : activeTab === 'categories' ? 'Category' : 'Brand'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-6 px-6 border-b border-slate-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('products')}
            className={`py-4 text-sm font-black transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'products' ? 'border-[#2D79A8] text-[#2D79A8]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 text-sm font-black transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'categories' ? 'border-[#2D79A8] text-[#2D79A8]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('brands')}
            className={`py-4 text-sm font-black transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'brands' ? 'border-[#2D79A8] text-[#2D79A8]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Brands
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'products' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs uppercase tracking-wider font-black text-slate-400 border-b border-slate-100">
                    <th className="pb-3 px-4">Product</th>
                    <th className="pb-3 px-4">Brand / Category</th>
                    <th className="pb-3 px-4">Price</th>
                    <th className="pb-3 px-4">Deposit</th>
                    <th className="pb-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {prodLoading ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-bold">Loading...</td></tr>
                  ) : products?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          {p.images?.[0]?.url ? <img src={p.images[0].url} className="w-full h-full object-contain p-1 mix-blend-multiply" /> : <Package className="w-6 h-6 text-slate-300" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-800">{p.name}</p>
                          <p className="text-xs font-semibold text-slate-500 truncate max-w-[200px]">{p.description}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        <span className="font-bold text-slate-700 block">{p.brand?.name}</span>
                        <span className="text-slate-500 font-medium">{p.category?.name}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[#2D79A8] font-black">₹{p.price}</span>
                      </td>
                      <td className="py-4 px-4">
                        {p.isJar ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-xs font-black">
                            <ShieldCheck className="w-3 h-3" />
                            ₹{p.depositAmount}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right flex items-center justify-end gap-3">
                        <button onClick={() => handleEdit(p)} className="text-[#2D79A8] hover:bg-[#2D79A8]/10 p-2 rounded-full transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {catLoading ? <p>Loading...</p> : categories?.map((cat: any) => (
                <div key={cat.id} className="border border-slate-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800">{cat.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{cat._count?.products || 0} Products</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(cat)} className="text-slate-400 hover:text-[#2D79A8] p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'brands' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {brandLoading ? <p>Loading...</p> : brands?.map((brand: any) => (
                <div key={brand.id} className="border border-slate-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow bg-slate-50/50">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden">
                    {brand.logoUrl ? <img src={brand.logoUrl} className="object-contain" /> : <span className="font-black text-slate-300">{brand.name[0]}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-slate-800">{brand.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{brand._count?.products || 0} Products</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(brand)} className="text-slate-400 hover:text-[#2D79A8] p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(brand.id)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
