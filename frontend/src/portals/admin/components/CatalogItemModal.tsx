import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: 'products' | 'categories' | 'brands';
  onSubmit: (data: any) => void;
  initialData?: any;
  brands?: any[];
  categories?: any[];
  isLoading?: boolean;
};

export default function CatalogItemModal({ isOpen, onClose, type, onSubmit, initialData, brands, categories, isLoading }: ModalProps) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || {});
    }
  }, [isOpen, type, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type: inputType } = e.target;
    let finalValue: any = value;
    
    if (inputType === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (inputType === 'number') {
      finalValue = value === '' ? '' : Number(value);
    } else if (inputType === 'file') {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        finalValue = files[0];
      } else {
        finalValue = undefined;
      }
    }
    
    setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Add New {type === 'products' ? 'Product' : type === 'categories' ? 'Category' : 'Brand'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="catalog-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name || ''}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all"
                placeholder="e.g. 20L Water Jar"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all"
                placeholder="Optional description"
                rows={3}
              />
            </div>

            {(type === 'brands' || type === 'categories') && (
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Image/Logo</label>
                {initialData?.[type === 'brands' ? 'logoUrl' : 'imageUrl'] && (
                  <img src={initialData[type === 'brands' ? 'logoUrl' : 'imageUrl']} alt="Current" className="h-16 mb-2 object-contain rounded-md" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  name="image"
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#245361]/10 file:text-[#245361] hover:file:bg-[#245361]/20"
                />
              </div>
            )}

            {type === 'products' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Price (₹)</label>
                    <input
                      type="number"
                      name="price"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Deposit Amount (₹)</label>
                    <input
                      type="number"
                      name="depositAmount"
                      min="0"
                      step="0.01"
                      value={formData.depositAmount || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all"
                      placeholder="150.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Brand</label>
                    <select
                      name="brandId"
                      required
                      value={formData.brandId || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all"
                    >
                      <option value="" disabled>Select Brand</option>
                      {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Category</label>
                    <select
                      name="categoryId"
                      required
                      value={formData.categoryId || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all"
                    >
                      <option value="" disabled>Select Category</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Image</label>
                  {initialData?.images?.[0]?.url && (
                    <img src={initialData.images[0].url} alt="Current" className="h-16 mb-2 object-contain rounded-md" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    name="image"
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D79A8]/20 focus:border-[#2D79A8] transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#245361]/10 file:text-[#245361] hover:file:bg-[#245361]/20"
                  />
                </div>

                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    name="isJar"
                    checked={formData.isJar || false}
                    onChange={handleChange}
                    className="w-5 h-5 text-[#2D79A8] border-slate-300 rounded focus:ring-[#2D79A8]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">Is a Jar Product</span>
                    <span className="text-xs font-medium text-slate-500">Requires a deposit and return tracking</span>
                  </div>
                </label>
              </>
            )}

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <button
            type="submit"
            form="catalog-form"
            disabled={isLoading}
            className="w-full bg-[#245361] hover:bg-[#245361]/90 text-white py-3.5 rounded-xl font-black shadow-lg shadow-[#245361]/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? 'Saving...' : 'Save ' + (type === 'products' ? 'Product' : type === 'categories' ? 'Category' : 'Brand')}
          </button>
        </div>
      </div>
    </div>
  );
}
