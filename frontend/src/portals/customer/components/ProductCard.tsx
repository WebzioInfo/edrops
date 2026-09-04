import React from 'react';
import { ShoppingCart, Zap, ShieldCheck } from 'lucide-react';

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    isJar?: boolean;
    depositAmount?: number;
    images?: Array<{ url: string }>;
    brand?: { name: string };
  };
  onAddToCart: (product: any) => void;
  onBuyNow: (product: any) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onBuyNow,
}) => {
  const brandName = product.brand?.name || 'Edrops Pure';
  const imageUrl = product.images?.[0]?.url;

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col overflow-hidden hover:shadow-md transition-all duration-300 group relative w-full h-full">
      {/* Image Area - Aspect Square with Top-Left Badge (w-full fills grid track) */}
      <div className="aspect-square w-full bg-[#F8FAFC] overflow-hidden flex items-center justify-center relative rounded-t-2xl">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-[#94A3B8]">
            <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 stroke-[1.5]" />
          </div>
        )}

        {/* Brand / Pure Badge */}
        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs text-[#1E88E5] text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border border-sky-100 shadow-xs">
          {brandName}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-2 sm:p-3 flex flex-col flex-1 justify-between gap-2">
        <div>
          {/* Title - Line clamp 2 */}
          <h3
            className="text-[13px] sm:text-[15px] font-bold text-[#0F172A] line-clamp-2 leading-snug min-h-[34px] sm:min-h-[40px]"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Pricing Row */}
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-[16px] sm:text-[19px] font-black text-[#1E88E5]">
              ₹{product.price}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-[#64748B]">
              / unit
            </span>
          </div>

          {/* Deposit Tag if applicable */}
          {product.isJar && product.depositAmount ? (
            <div className="flex items-center gap-1 text-[#64748B] text-[10px] sm:text-[11px] font-medium mt-0.5">
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#1E88E5] shrink-0" />
              <span>Deposit ₹{product.depositAmount}</span>
            </div>
          ) : null}
        </div>

        {/* Compact Action Buttons with Responsive Scaling */}
        <div className="pt-2 border-t border-[#F1F5F9] flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBuyNow(product);
            }}
            className="px-2.5 sm:px-3 h-[32px] sm:h-[36px] rounded-lg text-[11px] sm:text-xs font-bold border border-[#1E88E5] text-[#1E88E5] hover:bg-[#EBF5FB] flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
            title="Buy Now"
          >
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
            <span>Buy</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="flex-1 h-[32px] sm:h-[36px] rounded-lg text-[11px] sm:text-xs font-bold bg-[#1E88E5] text-white hover:bg-[#1565C0] flex items-center justify-center gap-1 sm:gap-1.5 transition-colors shadow-xs cursor-pointer truncate px-1.5"
            title="Add to Cart"
          >
            <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">Add to Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
