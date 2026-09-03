import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  User,
  MapPin,
  Package,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import {
  locationEngine,
  type PlaceSearchResult,
} from '../../../features/location/services/LocationEngine';

export interface CustomerSummary {
  id: string;
  customerType?: string;
  companyName?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
  addresses?: Array<{
    id: string;
    street: string;
    houseName?: string;
    buildingName?: string;
    area?: string;
    landmark?: string;
    city: string;
    district?: string;
    state?: string;
    zipCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
    googleMapsUrl?: string;
  }>;
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  isJar?: boolean;
  depositAmount?: number;
  brand?: {
    name: string;
  };
  images?: Array<{
    url: string;
    isPrimary?: boolean;
  }>;
}

export interface OrderLineItem {
  product: ProductItem;
  quantity: string;
  unitPrice: string;
}

export interface CustomDeliveryAddressState {
  placeName: string;
  street: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderFormModal({
  isOpen,
  onClose,
  onSuccess,
}: OrderFormModalProps) {
  // Master Data
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Delivery Location Mode: 'SAVED' (default) vs 'CUSTOM'
  const [locationMode, setLocationMode] = useState<'SAVED' | 'CUSTOM'>('SAVED');

  // Custom Address Fields
  const [customAddress, setCustomAddress] = useState<CustomDeliveryAddressState>({
    placeName: '',
    street: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    country: 'India',
    latitude: null,
    longitude: null,
    placeId: null,
  });

  // Custom Location Search (Google Places - No Map)
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSearchResult[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);

  // Order Items with String State
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Form State
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const locationSearchRef = useRef<HTMLDivElement>(null);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setLocationMode('SAVED');
    setCustomAddress({
      placeName: '',
      street: '',
      city: '',
      district: '',
      state: '',
      pincode: '',
      country: 'India',
      latitude: null,
      longitude: null,
      placeId: null,
    });
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setOrderItems([]);
    setProductSearchQuery('');
    setAdminNotes('');
    setFormError(null);
  }, []);

  // Load Real Customers & Products from DB & Reset Form
  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }

    resetForm();

    const loadData = async () => {
      setLoadingInitial(true);
      setFormError(null);
      try {
        const [custData, prodData] = await Promise.all([
          fetchWithAuth('/customer'),
          fetchWithAuth('/catalog/products'),
        ]);

        setCustomers(Array.isArray(custData) ? custData : []);
        setProducts(Array.isArray(prodData) ? prodData : []);
      } catch (err: any) {
        console.error('Failed to load database items:', err);
        setFormError('Failed to load customers or products from database.');
      } finally {
        setLoadingInitial(false);
      }
    };

    loadData();
  }, [isOpen, resetForm]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
      if (locationSearchRef.current && !locationSearchRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 15);
    const q = customerSearchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const name = `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.toLowerCase();
      const phone = (c.user?.phone || '').toLowerCase();
      const email = (c.user?.email || '').toLowerCase();
      const company = (c.companyName || '').toLowerCase();
      const address = c.addresses?.map((a) => `${a.street} ${a.city} ${a.district}`).join(' ').toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || email.includes(q) || company.includes(q) || address.includes(q);
    });
  }, [customers, customerSearchQuery]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products;
    const q = productSearchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const name = p.name.toLowerCase();
      const brand = (p.brand?.name || '').toLowerCase();
      return name.includes(q) || brand.includes(q);
    });
  }, [products, productSearchQuery]);

  // Select Customer
  const handleSelectCustomer = (customer: CustomerSummary) => {
    setSelectedCustomer(customer);
    setCustomerSearchQuery(
      `${customer.user?.firstName || ''} ${customer.user?.lastName || ''}`.trim() || customer.companyName || ''
    );
    setShowCustomerDropdown(false);
    setLocationMode('SAVED'); // Default to Customer Saved Location
  };

  // Google Places Search Query Handler
  const handleLocationSearchChange = (val: string) => {
    setLocationSearchQuery(val);
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);

    if (!val.trim() || val.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    setShowLocationSuggestions(true);
    locationDebounceRef.current = setTimeout(async () => {
      try {
        const { results } = await locationEngine.searchPlaces(val);
        setLocationSuggestions(results);
      } catch (err) {
        console.warn('Google place search error:', err);
      }
    }, 300);
  };

  // Select Search Result & Autofill Address Fields
  const handleSelectPlaceResult = async (place: PlaceSearchResult) => {
    setLocationSearchQuery(place.name);
    setShowLocationSuggestions(false);
    setResolvingPlace(true);

    try {
      const details = await locationEngine.getPlaceDetails(place);
      if (details) {
        setCustomAddress((prev) => ({
          placeName: details.name || place.name,
          street: prev.street || '',
          city: details.city || '',
          district: details.district || '',
          state: details.state || '',
          pincode: details.pincode || '',
          country: details.country || 'India',
          latitude: details.latitude || null,
          longitude: details.longitude || null,
          placeId: details.placeId || place.id,
        }));
      }
    } catch (err) {
      console.warn('Place details error:', err);
    } finally {
      setResolvingPlace(false);
    }
  };

  // Add Product to line items
  const handleAddProduct = (product: ProductItem) => {
    const existingIndex = orderItems.findIndex((item) => item.product.id === product.id);
    if (existingIndex > -1) {
      const updated = [...orderItems];
      const currentQty = parseInt(updated[existingIndex].quantity, 10) || 0;
      updated[existingIndex].quantity = String(currentQty + 1);
      setOrderItems(updated);
    } else {
      setOrderItems((prev) => [
        ...prev,
        {
          product,
          quantity: '1',
          unitPrice: String(product.price ?? '0'),
        },
      ]);
    }
    setProductSearchQuery('');
    setShowProductDropdown(false);
  };

  // Quantity text change (allows empty string while editing, only digits)
  const handleQuantityChange = (index: number, val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    const updated = [...orderItems];
    updated[index].quantity = val;
    setOrderItems(updated);
  };

  // Quantity Stepper (+ and -)
  const handleStepQuantity = (index: number, delta: number) => {
    const updated = [...orderItems];
    const currentStr = updated[index].quantity.trim();
    const currentNum = parseInt(currentStr, 10);

    if (delta > 0) {
      // Plus
      if (currentStr === '' || isNaN(currentNum) || currentNum <= 0) {
        updated[index].quantity = '1';
      } else {
        updated[index].quantity = String(currentNum + 1);
      }
    } else {
      // Minus: 1 becomes empty string "" (not 0)
      if (currentStr === '' || isNaN(currentNum) || currentNum <= 1) {
        updated[index].quantity = '';
      } else {
        updated[index].quantity = String(currentNum - 1);
      }
    }
    setOrderItems(updated);
  };

  // Unit price text change (allows empty string and decimal values e.g. "99.50", "100.")
  const handleUnitPriceChange = (index: number, val: string) => {
    if (val !== '' && !/^\d*\.?\d*$/.test(val)) return;
    const updated = [...orderItems];
    updated[index].unitPrice = val;
    setOrderItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Individual line item calculation
  const getItemLineTotal = (item: OrderLineItem): number => {
    const qty = item.quantity.trim() === '' ? 0 : parseInt(item.quantity, 10);
    const price = item.unitPrice.trim() === '' ? 0 : parseFloat(item.unitPrice);
    if (isNaN(qty) || isNaN(price) || qty <= 0 || price < 0) return 0;
    return Number((qty * price).toFixed(2));
  };

  // Grand totals calculations
  const subtotal = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + getItemLineTotal(item), 0);
  }, [orderItems]);

  const deliveryCharge = 0;
  const discountTotal = 0;
  const totalAmount = subtotal + deliveryCharge - discountTotal;

  // Active Customer Saved Address
  const customerDefaultAddress =
    selectedCustomer?.addresses?.find((a) => a.isDefault) || selectedCustomer?.addresses?.[0];

  // Submit Order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedCustomer) {
      setFormError('Please search and select a customer.');
      return;
    }

    if (orderItems.length === 0) {
      setFormError('Please add at least one product to the order.');
      return;
    }

    // Validate numeric items
    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      const qStr = item.quantity.trim();
      const pStr = item.unitPrice.trim();

      if (qStr === '' || isNaN(Number(qStr)) || Number(qStr) <= 0) {
        setFormError(`Please enter a valid quantity greater than 0 for "${item.product.name}".`);
        return;
      }
      if (pStr === '' || isNaN(Number(pStr)) || Number(pStr) < 0) {
        setFormError(`Please enter a valid unit price for "${item.product.name}".`);
        return;
      }
    }

    if (locationMode === 'CUSTOM') {
      if (!customAddress.street.trim() && !customAddress.placeName.trim()) {
        setFormError('Please enter street address / building details for the custom location.');
        return;
      }
      if (!customAddress.city.trim()) {
        setFormError('Please enter the City.');
        return;
      }
      if (!customAddress.pincode.trim()) {
        setFormError('Please enter the Pincode.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload: any = {
        customerId: selectedCustomer.id,
        deliveryLocationMode: locationMode === 'SAVED' ? 'SAVED' : 'OVERRIDE',
        adminNotes: adminNotes.trim() || undefined,
        items: orderItems.map((item) => ({
          productId: item.product.id,
          quantity: parseInt(item.quantity.trim(), 10),
          unitPrice: parseFloat(item.unitPrice.trim()),
        })),
      };

      if (locationMode === 'SAVED' && customerDefaultAddress?.id) {
        payload.deliveryAddressId = customerDefaultAddress.id;
      } else {
        payload.overrideAddress = {
          street: customAddress.street.trim() || customAddress.placeName.trim() || 'Delivery Point',
          buildingName: customAddress.placeName.trim() || undefined,
          city: customAddress.city.trim() || 'Kondotty',
          district: customAddress.district.trim() || 'Malappuram',
          state: customAddress.state.trim() || 'Kerala',
          zipCode: customAddress.pincode.trim() || '673638',
          country: customAddress.country || 'India',
          latitude: customAddress.latitude,
          longitude: customAddress.longitude,
          googleMapsUrl:
            customAddress.latitude && customAddress.longitude
              ? `https://www.google.com/maps/search/?api=1&query=${customAddress.latitude},${customAddress.longitude}`
              : undefined,
        };
      }

      await fetchWithAuth('/order', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Order creation error:', err);
      setFormError(err.message || 'Unable to create order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#16324F]">Create New Order</h2>
            <p className="text-xs text-[#64748B]">Manual order entry for delivery partner operations</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-[#16324F] hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. CUSTOMER SELECTION */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#16324F] uppercase tracking-wider">
              Customer <span className="text-red-500">*</span>
            </label>

            <div className="relative" ref={customerDropdownRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search customer by name, phone, email, or address..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                />
                <ChevronDown className="w-4 h-4 absolute right-3.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Customer Dropdown Results */}
              {showCustomerDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-30 divide-y divide-gray-100">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((c) => {
                      const cName =
                        `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.trim() ||
                        c.companyName ||
                        'Unnamed Customer';
                      const defaultAddr = c.addresses?.find((a) => a.isDefault) || c.addresses?.[0];
                      const addrText = defaultAddr
                        ? [defaultAddr.street, defaultAddr.city, defaultAddr.district].filter(Boolean).join(', ')
                        : 'No address saved';

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left p-3 hover:bg-blue-50/60 transition-colors flex items-start gap-3 cursor-pointer"
                        >
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-[#1677C8] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs sm:text-sm font-bold text-[#16324F] truncate">{cName}</p>
                              {c.customerType && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-[#64748B]">
                                  {c.customerType}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{c.user?.phone || 'No phone'}</span>
                            </p>
                            <p className="text-[11px] text-[#94A3B8] flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3 h-3 text-[#1677C8] shrink-0" />
                              <span>{addrText}</span>
                            </p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-[#64748B]">
                      {loadingInitial ? 'Loading customers database...' : 'No matching customers found.'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer Card */}
            {selectedCustomer && (
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-[#1677C8] text-white flex items-center justify-center text-xs font-bold">
                    {selectedCustomer.user?.firstName?.[0] || 'C'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#16324F]">
                      {selectedCustomer.user?.firstName} {selectedCustomer.user?.lastName}{' '}
                      {selectedCustomer.companyName ? `(${selectedCustomer.companyName})` : ''}
                    </p>
                    <p className="text-[11px] text-[#64748B]">Phone: {selectedCustomer.user?.phone}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearchQuery('');
                  }}
                  className="text-xs text-[#1677C8] hover:underline font-semibold cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* 2. DELIVERY LOCATION (EXACTLY TWO OPTIONS - NO MAP) */}
          {selectedCustomer && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-[#16324F] uppercase tracking-wider">
                Delivery Location <span className="text-red-500">*</span>
              </label>

              {/* Radio Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  onClick={() => setLocationMode('SAVED')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    locationMode === 'SAVED'
                      ? 'border-[#1677C8] bg-blue-50/40 ring-1 ring-[#1677C8]/20'
                      : 'border-gray-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryLocationMode"
                    checked={locationMode === 'SAVED'}
                    onChange={() => setLocationMode('SAVED')}
                    className="mt-0.5 text-[#1677C8] focus:ring-[#1677C8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#16324F] block">● Customer Saved Location</span>
                    <span className="text-[11px] text-[#64748B]">Use customer's saved profile address</span>
                  </div>
                </label>

                <label
                  onClick={() => setLocationMode('CUSTOM')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    locationMode === 'CUSTOM'
                      ? 'border-[#1677C8] bg-blue-50/40 ring-1 ring-[#1677C8]/20'
                      : 'border-gray-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryLocationMode"
                    checked={locationMode === 'CUSTOM'}
                    onChange={() => setLocationMode('CUSTOM')}
                    className="mt-0.5 text-[#1677C8] focus:ring-[#1677C8]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#16324F] block">○ Different Location For This Order</span>
                    <span className="text-[11px] text-[#64748B]">Specify custom one-time delivery address</span>
                  </div>
                </label>
              </div>

              {/* Option 1: Saved Delivery Address Preview */}
              {locationMode === 'SAVED' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1677C8] uppercase tracking-wider">
                      Saved Delivery Address Snapshot
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md">
                      Profile Default
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#16324F]">
                    {customerDefaultAddress?.houseName ||
                      customerDefaultAddress?.buildingName ||
                      customerDefaultAddress?.landmark ||
                      'Customer Address'}
                  </p>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {[
                      customerDefaultAddress?.street,
                      customerDefaultAddress?.city,
                      customerDefaultAddress?.district,
                      customerDefaultAddress?.state,
                      customerDefaultAddress?.zipCode ? `- ${customerDefaultAddress.zipCode}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] pt-0.5">
                    Customer's saved delivery location will be snapshotted for this order.
                  </p>
                </div>
              )}

              {/* Option 2: Different Location For This Order (Compact Custom Form with Google Places Search) */}
              {locationMode === 'CUSTOM' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#16324F] uppercase tracking-wider">
                      Custom Delivery Address
                    </span>
                    <span className="text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded-md border border-gray-200">
                      Does not modify customer profile
                    </span>
                  </div>

                  {/* Google Place Search */}
                  <div className="relative" ref={locationSearchRef}>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      Place / Building / Landmark Search
                    </label>
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search place, shop, building, landmark, area (e.g. Biofix, Japan Square)..."
                        value={locationSearchQuery}
                        onChange={(e) => handleLocationSearchChange(e.target.value)}
                        onFocus={() => {
                          if (locationSuggestions.length > 0) setShowLocationSuggestions(true);
                        }}
                        className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] text-[#16324F]"
                      />
                      {resolvingPlace && (
                        <Loader2 className="w-4 h-4 absolute right-3 text-[#1677C8] animate-spin" />
                      )}
                    </div>

                    {/* Google Place Suggestions Dropdown */}
                    {showLocationSuggestions && locationSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto z-30 divide-y divide-gray-100">
                        {locationSuggestions.map((place) => (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => handleSelectPlaceResult(place)}
                            className="w-full text-left p-2.5 hover:bg-blue-50/60 transition-colors flex items-start gap-2 cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-[#16324F]">{place.name}</p>
                              <p className="text-[11px] text-[#64748B] line-clamp-1">
                                {place.secondaryText || place.description}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Street Address / Building */}
                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      Street Address / Building / Door No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 4B, Hilltop Towers, Green Valley Road"
                      value={customAddress.street}
                      onChange={(e) => setCustomAddress((prev) => ({ ...prev, street: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] text-[#16324F]"
                    />
                  </div>

                  {/* Structured Autofilled Components: City, District, State, Pincode */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#16324F] mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="City"
                        value={customAddress.city}
                        onChange={(e) => setCustomAddress((prev) => ({ ...prev, city: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none focus:border-[#1677C8] text-[#16324F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#16324F] mb-1">District</label>
                      <input
                        type="text"
                        placeholder="District"
                        value={customAddress.district}
                        onChange={(e) => setCustomAddress((prev) => ({ ...prev, district: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none focus:border-[#1677C8] text-[#16324F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#16324F] mb-1">State</label>
                      <input
                        type="text"
                        placeholder="State"
                        value={customAddress.state}
                        onChange={(e) => setCustomAddress((prev) => ({ ...prev, state: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none focus:border-[#1677C8] text-[#16324F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#16324F] mb-1">
                        Pincode <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={customAddress.pincode}
                        onChange={(e) => setCustomAddress((prev) => ({ ...prev, pincode: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-lg outline-none focus:border-[#1677C8] text-[#16324F]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. ORDER ITEMS (PRODUCTS) */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#16324F] uppercase tracking-wider">
                Order Items <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-[#64748B] font-semibold">{orderItems.length} items</span>
            </div>

            {/* Product Selector Dropdown */}
            <div className="relative" ref={productDropdownRef}>
              <div className="relative flex items-center">
                <Package className="w-4 h-4 absolute left-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or brand..."
                  value={productSearchQuery}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                />
                <Plus className="w-4 h-4 absolute right-3.5 text-[#1677C8] pointer-events-none" />
              </div>

              {/* Product Dropdown Results */}
              {showProductDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-30 divide-y divide-gray-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="w-full text-left p-3 hover:bg-blue-50/60 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#1677C8] flex items-center justify-center font-bold text-xs">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-[#16324F]">{p.name}</p>
                            <p className="text-[11px] text-[#64748B]">
                              {p.brand?.name || 'Edrops'} • {p.isJar ? 'Returnable Jar' : 'Bottled'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#1677C8]">₹{Number(p.price).toFixed(2)}</p>
                          <span className="text-[10px] text-emerald-600 font-semibold">+ Add Item</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-[#64748B]">No matching products found.</div>
                  )}
                </div>
              )}
            </div>

            {/* Line Items Table */}
            {orderItems.length > 0 ? (
              <div className="space-y-2 border border-[#E2E8F0] rounded-xl overflow-hidden divide-y divide-gray-100">
                {orderItems.map((item, idx) => {
                  return (
                    <div
                      key={item.product.id}
                      className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[#16324F] truncate">{item.product.name}</p>
                        <p className="text-[11px] text-[#64748B]">
                          Catalog Price: ₹{Number(item.product.price).toFixed(2)}
                        </p>
                      </div>

                      {/* Controls: Quantity & Editable Unit Price */}
                      <div className="flex items-center gap-3">
                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleStepQuantity(idx, -1)}
                            className="h-7 w-7 rounded-md bg-white hover:bg-slate-200 text-[#16324F] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            className="w-10 text-center text-xs font-bold text-[#16324F] bg-transparent outline-none placeholder:text-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepQuantity(idx, 1)}
                            className="h-7 w-7 rounded-md bg-white hover:bg-slate-200 text-[#16324F] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                            title="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Editable Unit Price */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#64748B]">@ ₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={item.unitPrice}
                            onChange={(e) => handleUnitPriceChange(idx, e.target.value)}
                            className="w-20 px-2 py-1 text-xs font-bold text-[#16324F] bg-white border border-gray-200 rounded-lg outline-none focus:border-[#1677C8] placeholder:text-gray-300"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-20 text-right">
                          <p className="text-xs sm:text-sm font-bold text-[#1677C8]">
                            ₹{getItemLineTotal(item).toFixed(2)}
                          </p>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center text-xs text-[#64748B] bg-slate-50">
                No products added yet. Use the product search bar above to add water jars or bottles.
              </div>
            )}
          </div>

          {/* 4. ORDER NOTES */}
          <div className="pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-[#16324F] mb-1">Order Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Deliver before 10 AM, Gate code 1234, Leave at reception"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] text-[#16324F]"
              />
            </div>
          </div>

          {/* 5. ORDER SUMMARY */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-[#64748B]">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#64748B]">
              <span>Delivery Charge</span>
              <span>₹{deliveryCharge.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#64748B]">
              <span>Discount</span>
              <span>₹{discountTotal.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm font-bold text-[#16324F]">
              <span>Total Amount</span>
              <span className="text-base text-[#1677C8]">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || orderItems.length === 0 || !selectedCustomer}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] shadow-2xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Order...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Create Order · ₹{totalAmount.toFixed(2)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
