import { X, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

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

const ALLOWED_EXTENSIONS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function CatalogItemModal({
  isOpen,
  onClose,
  type,
  onSubmit,
  initialData,
  brands,
  categories,
  isLoading,
}: ModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || {});
      setSelectedFile(null);

      // Set initial preview from existing image
      if (initialData) {
        if (type === 'products' && initialData.images?.[0]?.url) {
          setPreviewUrl(initialData.images[0].url);
        } else if (type === 'brands' && initialData.logoUrl) {
          setPreviewUrl(initialData.logoUrl);
        } else if (type === 'categories' && initialData.imageUrl) {
          setPreviewUrl(initialData.imageUrl);
        } else {
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(null);
      }
    } else {
      // Clean up object URL when closed
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setSelectedFile(null);
    }
  }, [isOpen, type, initialData]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 1. Validate MIME type
    if (!ALLOWED_EXTENSIONS.includes(file.type.toLowerCase())) {
      toast.error('Only JPEG, PNG, and WEBP images are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate Size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Image size must be smaller than ${MAX_FILE_SIZE_MB} MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Revoke previous blob url
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setFormData((prev: any) => ({ ...prev, image: file }));
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData((prev: any) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type: inputType } = e.target;
    let finalValue: any = value;

    if (inputType === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (inputType === 'number') {
      finalValue = value === '' ? '' : Number(value);
    }

    setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
              {initialData ? 'Edit' : 'Add New'}{' '}
              {type === 'products' ? 'Product' : type === 'categories' ? 'Category' : 'Brand'}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Fill in the details below to publish to the catalog.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          <form id="catalog-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name || ''}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] transition-all placeholder:text-slate-400"
                placeholder={
                  type === 'products'
                    ? 'e.g. Edrops 20L Water Jar'
                    : type === 'categories'
                    ? 'e.g. Drinking Water'
                    : 'e.g. Edrops Pure'
                }
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] transition-all placeholder:text-slate-400"
                placeholder="Optional description or specifications"
                rows={2}
              />
            </div>

            {/* Product Specific Fields */}
            {type === 'products' && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                      Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="price"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price ?? ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] transition-all"
                      placeholder="80.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                      Deposit Amount (₹)
                    </label>
                    <input
                      type="number"
                      name="depositAmount"
                      min="0"
                      step="0.01"
                      value={formData.depositAmount ?? ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] transition-all"
                      placeholder="150.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                      Brand <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="brandId"
                      required
                      value={formData.brandId || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] transition-all"
                    >
                      <option value="" disabled>
                        Select Brand
                      </option>
                      {brands?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="categoryId"
                      required
                      value={formData.categoryId || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] transition-all"
                    >
                      <option value="" disabled>
                        Select Category
                      </option>
                      {categories?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Image Upload & Interactive Live Preview Section */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                {type === 'brands' ? 'Brand Logo' : 'Product Image'}
              </label>

              {previewUrl ? (
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      {selectedFile ? (
                        <>
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {formatFileSize(selectedFile.size)} • Ready to upload
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> New image selected
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-slate-700">Current Image</p>
                          <p className="text-[11px] text-slate-400">Stored on Cloudinary</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 text-xs font-bold text-[#1E88E5] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    >
                      Change
                    </button>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Remove selection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#1E88E5] bg-slate-50/50 hover:bg-blue-50/20 rounded-2xl p-4 sm:p-6 text-center cursor-pointer transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1E88E5] flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    Click to browse image file
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    JPEG, PNG, or WEBP (Max {MAX_FILE_SIZE_MB}MB)
                  </p>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                name="image"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Is a Jar Product checkbox */}
            {type === 'products' && (
              <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  name="isJar"
                  checked={formData.isJar || false}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#1E88E5] border-slate-300 rounded focus:ring-[#1E88E5]"
                />
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    Is a Jar Product
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    Requires a security deposit and empty jar return tracking
                  </span>
                </div>
              </label>
            )}
          </form>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="catalog-form"
            disabled={isLoading}
            className="flex-2 py-3 px-4 bg-[#1E88E5] hover:bg-[#1565C0] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-98 disabled:opacity-50 disabled:active:scale-100 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving {selectedFile ? 'Image & Item...' : '...'}</span>
              </>
            ) : (
              <span>
                {initialData ? 'Update' : 'Save'}{' '}
                {type === 'products' ? 'Product' : type === 'categories' ? 'Category' : 'Brand'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
