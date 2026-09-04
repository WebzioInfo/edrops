import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../api/client';
import { formatOrderId, formatOrderStatus } from '../../utils/orderFormatters';

export default function CustomerProfile({ basePath }: { basePath: string }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchWithAuth(`/customer/${id}`),
  });

  if (isLoading) return <div className="p-10 text-center">Loading customer profile...</div>;
  if (error || !customer) return <div className="p-10 text-center text-red-500">Failed to load customer profile</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(basePath)} className="text-gray-500 hover:text-gray-800">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Customer Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-[#245361] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {customer.user.firstName[0]}{customer.user.lastName[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{customer.user.firstName} {customer.user.lastName}</h2>
                <p className="text-sm text-gray-500">{customer.customerType || 'Residential'}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer ID</span>
                <span className="font-mono text-gray-800">{customer.id.substring(0,8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="text-gray-800">{customer.user.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-800">{customer.user.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Joined</span>
                <span className="text-gray-800">{new Date(customer.user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-1 text-xs rounded-full ${customer.user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {customer.user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Addresses</h3>
            <div className="space-y-4">
              {customer.addresses?.map((addr: any) => (
                <div key={addr.id} className="text-sm">
                  {addr.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full mb-2 inline-block">Default</span>}
                  <p className="text-gray-800">{addr.street}</p>
                  <p className="text-gray-600">{addr.city}, {addr.state} - {addr.zipCode}</p>
                </div>
              ))}
              {customer.addresses?.length === 0 && <p className="text-gray-500 text-sm">No addresses added yet.</p>}
            </div>
          </div>
        </div>

        {/* Right Column: Metrics & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow border border-gray-100 border-l-4 border-l-green-500">
              <p className="text-sm text-gray-500 mb-1">Wallet Balance</p>
              <h3 className="text-2xl font-bold text-gray-800">₹{customer.wallet?.balance || 0}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl shadow border border-gray-100 border-l-4 border-l-[#245361]">
              <p className="text-sm text-gray-500 mb-1">Prepaid Jars</p>
              <h3 className="text-2xl font-bold text-gray-800">{customer.jarBalance?.availableJars || 0}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl shadow border border-gray-100 border-l-4 border-l-[#F69C14]">
              <p className="text-sm text-gray-500 mb-1">Held Jars (Empty/Full)</p>
              <h3 className="text-2xl font-bold text-gray-800">{customer.jarOwnership?.companyJarsHeld || 0}</h3>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow border border-gray-100">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800">Recent Orders</h3>
            </div>
            <div className="p-4">
              {customer.orders?.length > 0 ? (
                <div className="space-y-4">
                  {customer.orders.slice(0,5).map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-gray-800">{formatOrderId(order.id)}</p>
                        <p className="text-gray-500 text-xs">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">₹{order.totalAmount}</p>
                        <p className={`text-xs ${order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'text-green-600' : 'text-[#F69C14]'}`}>{formatOrderStatus(order.status)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No recent orders.</p>
              )}
            </div>
          </div>

          {/* Recent Deliveries */}
          <div className="bg-white rounded-xl shadow border border-gray-100">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800">Recent Deliveries</h3>
            </div>
            <div className="p-4">
              {customer.deliveries?.length > 0 ? (
                <div className="space-y-4">
                  {customer.deliveries.slice(0,5).map((del: any) => (
                    <div key={del.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-gray-800">{new Date(del.scheduledFor).toLocaleDateString()}</p>
                        <p className="text-gray-500 text-xs">Required: {del.requiredQuantity} jars</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs ${del.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {del.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No recent deliveries.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
