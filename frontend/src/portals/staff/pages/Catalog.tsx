import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { hasCatalogPermission } from '../../../contexts/AuthContext';
import { fetchWithAuth } from '../../../api/client';
import CatalogManager from '../../admin/pages/CatalogManager';

export default function StaffCatalog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyBackendAccess() {
      // Immediate frontend permission check
      if (!hasCatalogPermission(user)) {
        if (isMounted) {
          setAuthorized(false);
          setChecking(false);
        }
        return;
      }

      // Backend API authorization verification
      try {
        await fetchWithAuth('/catalog/access-check');
        if (isMounted) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setAuthorized(false);
          setChecking(false);
        }
      }
    }

    verifyBackendAccess();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 space-y-3">
        <Loader2 className="w-6 h-6 text-[#1677C8] animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Verifying catalog permissions...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-10 max-w-lg mx-auto text-center space-y-4 my-8 animate-in fade-in">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-[#16324F]">
            Catalog Access Restricted
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Your staff account does not currently have permission to access or manage the product catalog. Please contact an administrator to request catalog operational access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/staff/orders')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Staff Orders</span>
        </button>
      </div>
    );
  }

  return <CatalogManager />;
}
