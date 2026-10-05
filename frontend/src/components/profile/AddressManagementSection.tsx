import { useState } from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../../api/client';
import AddressModal, { type AddressData } from './AddressModal';
import DeleteAddressModal from './DeleteAddressModal';

interface AddressManagementSectionProps {
  addresses: AddressData[];
  onRefresh: () => void;
}

export default function AddressManagementSection({
  addresses,
  onRefresh,
}: AddressManagementSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressData | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<AddressData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Primary address is either flagged isDefault or the first address
  const primaryAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;
  const secondaryAddresses = addresses.filter((a) => a.id !== primaryAddress?.id);

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (addr: AddressData) => {
    setEditingAddress(addr);
    setModalOpen(true);
  };

  const handleOpenDelete = (addr: AddressData) => {
    setAddressToDelete(addr);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!addressToDelete?.id) return;
    setIsDeleting(true);
    try {
      await fetchWithAuth(`/profile/addresses/${addressToDelete.id}`, {
        method: 'DELETE',
      });
      toast.success('Address deleted successfully');
      setDeleteModalOpen(false);
      setAddressToDelete(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete address');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetPrimary = async (addressId?: string) => {
    if (!addressId) return;
    try {
      await fetchWithAuth(`/profile/addresses/${addressId}/primary`, {
        method: 'PATCH',
      });
      toast.success('Primary delivery address updated');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary address');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Delivery Addresses
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Address</span>
        </button>
      </div>

      {/* No Address Empty State */}
      {addresses.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-400 flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6 text-[#1677C8]" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              No delivery address added yet.
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Add your delivery address for 20L water jar fulfillment.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Address</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Primary Address Column */}
          {primaryAddress && (
            <div className={`space-y-2 ${secondaryAddresses.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Primary Delivery Address
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <CheckCircle2 className="w-3 h-3" />
                  Primary
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
                  <span className="text-sm font-bold text-slate-900">
                    {primaryAddress.label || 'Default Address'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(primaryAddress)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#1677C8] hover:text-[#125ea0] transition cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(primaryAddress)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Structured Address Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {primaryAddress.houseName && (
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        House / Flat
                      </span>
                      <span className="font-semibold text-slate-800">{primaryAddress.houseName}</span>
                    </div>
                  )}

                  {primaryAddress.buildingName && (
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Building
                      </span>
                      <span className="font-semibold text-slate-800">{primaryAddress.buildingName}</span>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Street / Road
                    </span>
                    <span className="font-semibold text-slate-800">{primaryAddress.street}</span>
                  </div>

                  {primaryAddress.area && (
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Area / Locality
                      </span>
                      <span className="font-semibold text-slate-800">{primaryAddress.area}</span>
                    </div>
                  )}

                  {primaryAddress.landmark && (
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Landmark
                      </span>
                      <span className="font-semibold text-slate-800">{primaryAddress.landmark}</span>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      City
                    </span>
                    <span className="font-semibold text-slate-800">{primaryAddress.city}</span>
                  </div>

                  {primaryAddress.district && (
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        District
                      </span>
                      <span className="font-semibold text-slate-800">{primaryAddress.district}</span>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      State
                    </span>
                    <span className="font-semibold text-slate-800">{primaryAddress.state}</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pincode
                    </span>
                    <span className="font-semibold font-mono text-slate-800">{primaryAddress.zipCode}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Secondary / Other Saved Addresses */}
          <div className={`space-y-2 ${secondaryAddresses.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Other Saved Addresses ({secondaryAddresses.length})
            </span>

            {secondaryAddresses.length > 0 ? (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {secondaryAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {addr.label || 'Saved Address'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(addr.id)}
                          className="text-[11px] font-bold text-[#1677C8] hover:underline cursor-pointer"
                        >
                          Make Primary
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(addr)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Edit
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(addr)}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {[
                        addr.houseName,
                        addr.buildingName,
                        addr.street,
                        addr.area,
                        addr.city,
                        addr.zipCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5 bg-slate-50/30">
                <p className="text-xs text-slate-400 font-medium">
                  No additional delivery addresses saved.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="text-xs font-bold text-[#1677C8] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add another address</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddressModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        addressToEdit={editingAddress}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation Modal */}
      <DeleteAddressModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setAddressToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        addressLabel={addressToDelete?.label || addressToDelete?.street}
      />
    </div>
  );
}
