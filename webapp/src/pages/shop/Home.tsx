import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts, useBrands } from '../../lib/shopApi';
import useCartStore from '../../store/useCartStore';
import ClayCard from '../../components/shop/ui/ClayCard';
import ClayButton from '../../components/shop/ui/ClayButton';
import { ShoppingCart, Plus, Package } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { addItem, cartCount } = useCartStore();
  const [activeBrand, setActiveBrand] = useState(null);

  const { data: brands = [] } = useBrands();
  const { data: products = [], isLoading } = useProducts(activeBrand);

  const count = cartCount();

  return (
    <div className="space-y-6 pb-6">
      {/* Banner */}
      <ClayCard className="bg-gradient-to-br from-primary/10 to-primary/5 border-none relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <h2 className="text-xl font-bold text-primary mb-1">Pure Water, Delivered Fast</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          Order now — delivered to your door in your locality.
        </p>
        {count > 0 && (
          <ClayButton
            onClick={() => navigate('/cart')}
            className="text-sm px-4 py-2 h-auto gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            View Cart ({count})
          </ClayButton>
        )}
      </ClayCard>

      {/* Brand Filter Tabs */}
      {brands.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          <button
            onClick={() => setActiveBrand(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-2xl text-sm font-medium transition-all
              ${!activeBrand ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground'}`}
          >
            All
          </button>
          {brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => setActiveBrand(brand.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-2xl text-sm font-medium transition-all
                ${activeBrand === brand.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground'}`}
            >
              {brand.name}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div>
        <div className="flex items-center justify-between mb-4 ml-1">
          <h3 className="font-semibold text-lg">Products</h3>
          <span className="text-xs text-muted-foreground">{products.length} items</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="clay-card animate-pulse">
                <div className="aspect-square bg-muted rounded-xl mb-3" />
                <div className="h-3 bg-muted rounded mb-2 w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <ClayCard className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No products available</p>
          </ClayCard>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <ClayCard key={product.id} className="p-3 flex flex-col gap-2">
                <div className="aspect-square bg-primary/5 rounded-xl overflow-hidden mb-2">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-primary/30" />
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {product.brand?.name}
                </div>
                <h4 className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</h4>
                {product.weightLitre && (
                  <span className="text-xs text-muted-foreground">{product.weightLitre}L</span>
                )}
                <div className="mt-auto flex items-end justify-between gap-2">
                  <div>
                    <span className="font-bold text-base">₹{Number(product.price)}</span>
                    {Number(product.deposit) > 0 && (
                      <span className="text-[10px] text-muted-foreground block">
                        +₹{Number(product.deposit)} deposit
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      addItem({
                        id: product.id,
                        name: product.name,
                        price: Number(product.price),
                        deposit: Number(product.deposit),
                        imageUrl: product.imageUrl,
                      })
                    }
                    className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                    style={{ boxShadow: '3px 3px 6px #d1d9e6, -3px -3px 6px #ffffff' }}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </ClayCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
