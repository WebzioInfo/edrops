import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../api/client';
import { useNavigate } from 'react-router-dom';

export default function CustomerList({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchWithAuth('/customer'),
  });

  const filteredCustomers = customers?.filter((c: any) =>
    `${c.user.firstName} ${c.user.lastName} ${c.user.email} ${c.user.phone}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
          <p className="text-sm text-gray-500">Manage all registered customers</p>
        </div>
        <button
          onClick={() => navigate(`${basePath}/add`)}
          className="bg-[#F69C14] hover:bg-[#d8870f] text-white px-4 py-2 rounded-lg shadow font-medium transition-colors"
        >
          + Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-1/3 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7EBFE4]"
          />
        </div>
        
        {isLoading ? (
          <div className="p-10 text-center text-gray-500">Loading customers...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">Failed to load customers</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Customer ID</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Wallet</th>
                  <th className="px-6 py-3 font-medium">Jars</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers?.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-gray-500">{customer.id.substring(0, 8)}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{customer.user.firstName} {customer.user.lastName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>{customer.user.phone}</div>
                      <div className="text-gray-400 text-xs">{customer.user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium border border-blue-100">
                        {customer.customerType || 'RESIDENTIAL'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      ₹{customer.wallet?.balance || 0}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[#245361]">
                      {customer.jarBalance?.availableJars || 0}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => navigate(`${basePath}/${customer.id}`)}
                        className="text-[#F69C14] hover:text-[#d8870f] text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCustomers?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
