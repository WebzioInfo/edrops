import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  RefreshCw,
  AlertOctagon,
  ArrowRightLeft,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Eye,
  Building2,
  Package,
  History,
  X,
  Users,
  Factory,
  Droplets,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import CopyReferralCodeButton from '../../../components/common/CopyReferralCodeButton';

type ActiveTab = 'COMPANY' | 'DISTRIBUTORS' | 'RAW_MATERIALS' | 'MOVEMENTS';

export default function InventoryAudit() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('COMPANY');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Central Dashboard Data
  const [dashboard, setDashboard] = useState<any>(null);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [movementsData, setMovementsData] = useState<{
    movements: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    movements: [],
    pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
  });

  // Filters for Distributors
  const [distSearch, setDistSearch] = useState('');
  const [distStatusFilter, setDistStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Filters for Movements
  const [movSearch, setMovSearch] = useState('');
  const [movDistFilter, setMovDistFilter] = useState('ALL');
  const [movActionFilter, setMovActionFilter] = useState('ALL');
  const [movPage, setMovPage] = useState(1);

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    | null
    | 'TRANSFER'
    | 'RETURN'
    | 'ADJUST_DISTRIBUTOR'
    | 'ADJUST_COMPANY'
    | 'PRODUCTION'
    | 'REPLENISH'
    | 'DAMAGE'
    | 'DIST_DETAIL'
    | 'ISSUE_MATERIALS'
  >(null);

  // Raw Materials state
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [rawMovements, setRawMovements] = useState<any[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [issueDistributorId, setIssueDistributorId] = useState('');
  const [issueItems, setIssueItems] = useState<{ [materialCode: string]: number }>({});
  const [issueReference, setIssueReference] = useState('');
  const [issueNotes, setIssueNotes] = useState('');

  // Selected distributor for modal actions / detail
  const [selectedDistributor, setSelectedDistributor] = useState<any>(null);
  const [distDetailLoading, setDistDetailLoading] = useState(false);
  const [distDetailData, setDistDetailData] = useState<any>(null);

  // Form states
  const [submitting, setSubmitting] = useState(false);

  // Transfer form
  const [transferDistId, setTransferDistId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(50);
  const [transferNotes, setTransferNotes] = useState('');

  // Return form
  const [returnDistId, setReturnDistId] = useState('');
  const [returnType, setReturnType] = useState<'EMPTY' | 'FILLED'>('EMPTY');
  const [returnQty, setReturnQty] = useState<number>(10);
  const [returnNotes, setReturnNotes] = useState('');

  // Adjust Distributor form
  const [adjustDistId, setAdjustDistId] = useState('');
  const [adjustState, setAdjustState] = useState<'FILLED_YARD' | 'EMPTY_YARD' | 'DAMAGED'>('FILLED_YARD');
  const [adjustNewQty, setAdjustNewQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Adjust Company form
  const [compFilled, setCompFilled] = useState<number>(0);
  const [compEmpty, setCompEmpty] = useState<number>(0);
  const [compDamaged, setCompDamaged] = useState<number>(0);
  const [compReason, setCompReason] = useState('');
  const [compNotes, setCompNotes] = useState('');

  // Production / Replenish / Damage forms
  const [simpleQty, setSimpleQty] = useState<number>(25);
  const [damageType, setDamageType] = useState<'FILLED' | 'EMPTY'>('FILLED');
  const [damageReason, setDamageReason] = useState('');

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const [dashRes, distsRes] = await Promise.all([
        fetchWithAuth('/inventory/central-dashboard'),
        fetchWithAuth('/inventory/distributors'),
      ]);

      setDashboard(dashRes);
      setDistributors(distsRes || []);

      // If movements tab or initial load, fetch movements
      await loadMovements(movPage, movDistFilter, movActionFilter, movSearch);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load central inventory data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMovements = async (page: number, distId: string, action: string, search: string) => {
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '25');
      if (distId !== 'ALL') params.append('distributorId', distId);
      if (action !== 'ALL') params.append('action', action);
      if (search.trim()) params.append('search', search.trim());

      const data = await fetchWithAuth(`/inventory/movements?${params.toString()}`);
      setMovementsData(data);
    } catch (err) {
      console.error('Failed to load movements', err);
    }
  };

  const loadRawMaterials = async () => {
    try {
      setRawLoading(true);
      const [mats, movs] = await Promise.all([
        fetchWithAuth('/inventory/raw-materials'),
        fetchWithAuth('/inventory/raw-materials/movements'),
      ]);
      setRawMaterials(mats || []);
      setRawMovements(movs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load raw materials');
    } finally {
      setRawLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadRawMaterials();
  }, []);

  const handleOpenDistDetail = async (dist: any) => {
    setSelectedDistributor(dist);
    setActiveModal('DIST_DETAIL');
    setDistDetailLoading(true);
    try {
      const detail = await fetchWithAuth(`/inventory/distributors/${dist.id}`);
      setDistDetailData(detail);
    } catch (err: any) {
      toast.error('Failed to load distributor details');
    } finally {
      setDistDetailLoading(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (dist?: any) => {
    if (dist) {
      setTransferDistId(dist.id);
    } else if (distributors.length > 0) {
      setTransferDistId(distributors[0].id);
    }
    setTransferQty(25);
    setTransferNotes('');
    setActiveModal('TRANSFER');
  };

  // Open Return Modal
  const openReturnModal = (dist?: any) => {
    if (dist) {
      setReturnDistId(dist.id);
    } else if (distributors.length > 0) {
      setReturnDistId(distributors[0].id);
    }
    setReturnType('EMPTY');
    setReturnQty(10);
    setReturnNotes('');
    setActiveModal('RETURN');
  };

  // Open Adjust Distributor Modal
  const openAdjustDistModal = (dist?: any) => {
    const targetDist = dist || (distributors.length > 0 ? distributors[0] : null);
    if (!targetDist) {
      toast.error('No distributor available to adjust');
      return;
    }
    setAdjustDistId(targetDist.id);
    setSelectedDistributor(targetDist);
    setAdjustState('FILLED_YARD');
    setAdjustNewQty(targetDist.companyOwned?.available ?? 0);
    setAdjustReason('');
    setAdjustNotes('');
    setActiveModal('ADJUST_DISTRIBUTOR');
  };

  // Open Adjust Company Modal
  const openAdjustCompanyModal = () => {
    setCompFilled(dashboard?.companyStock?.filledJars ?? 0);
    setCompEmpty(dashboard?.companyStock?.emptyJars ?? 0);
    setCompDamaged(dashboard?.companyStock?.damagedJars ?? 0);
    setCompReason('');
    setCompNotes('');
    setActiveModal('ADJUST_COMPANY');
  };

  // Open Issue Materials Modal
  const openIssueMaterialsModal = (dist?: any) => {
    const mfgDists = distributors.filter((d) => d.canManufacture);
    if (mfgDists.length === 0) {
      toast.error('No distributors are currently authorized for manufacturing. Enable manufacturing permission in Distributor Management first.');
      return;
    }
    if (dist && dist.canManufacture) {
      setIssueDistributorId(dist.id);
    } else {
      setIssueDistributorId(mfgDists[0].id);
    }
    setIssueItems({});
    setIssueReference('');
    setIssueNotes('');
    setActiveModal('ISSUE_MATERIALS');
    if (rawMaterials.length === 0) {
      loadRawMaterials();
    }
  };

  // =========================================================================
  // SUBMISSIONS
  // =========================================================================

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferDistId) {
      toast.error('Please select a distributor.');
      return;
    }
    if (transferQty <= 0) {
      toast.error('Transfer quantity must be at least 1 jar.');
      return;
    }
    if (transferQty > (dashboard?.companyStock?.filledJars ?? 0)) {
      toast.error(`Cannot transfer more than available company stock (${dashboard?.companyStock?.filledJars ?? 0}).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/inventory/transfer', {
        method: 'POST',
        body: JSON.stringify({
          distributorId: transferDistId,
          quantity: transferQty,
          notes: transferNotes,
        }),
      });

      toast.success(`Transferred ${res.transferredQty} jars to ${res.distributorAgency || 'distributor'}!`);
      setActiveModal(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnDistId) {
      toast.error('Please select a distributor.');
      return;
    }
    if (returnQty <= 0) {
      toast.error('Return quantity must be at least 1 jar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/inventory/return', {
        method: 'POST',
        body: JSON.stringify({
          distributorId: returnDistId,
          stockType: returnType,
          quantity: returnQty,
          notes: returnNotes,
        }),
      });

      toast.success(`Received ${res.returnedQty} ${returnType.toLowerCase()} jars from distributor!`);
      setActiveModal(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Return receipt failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustDistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustReason.trim()) {
      toast.error('Adjustment reason is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/inventory/adjust-distributor', {
        method: 'POST',
        body: JSON.stringify({
          distributorId: adjustDistId,
          state: adjustState,
          newQuantity: adjustNewQty,
          reason: adjustReason,
          notes: adjustNotes,
        }),
      });

      toast.success(`Distributor stock adjusted by ${res.delta > 0 ? '+' : ''}${res.delta} jars!`);
      setActiveModal(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Stock adjustment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compReason.trim()) {
      toast.error('Adjustment reason is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      await fetchWithAuth('/inventory/adjust-company', {
        method: 'POST',
        body: JSON.stringify({
          filledJars: compFilled,
          emptyJars: compEmpty,
          damagedJars: compDamaged,
          reason: compReason,
          notes: compNotes,
        }),
      });

      toast.success('Company warehouse inventory adjusted successfully!');
      setActiveModal(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Adjustment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimpleOpsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (simpleQty <= 0) {
      toast.error('Quantity must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      if (activeModal === 'PRODUCTION') {
        await fetchWithAuth('/inventory/production', {
          method: 'POST',
          body: JSON.stringify({ qty: simpleQty }),
        });
        toast.success(`Production logged! ${simpleQty} empty jars filled.`);
      } else if (activeModal === 'REPLENISH') {
        await fetchWithAuth('/inventory/replenish', {
          method: 'POST',
          body: JSON.stringify({ qty: simpleQty }),
        });
        toast.success(`Warehouse restocked with ${simpleQty} filled jars.`);
      } else if (activeModal === 'DAMAGE') {
        await fetchWithAuth('/inventory/damage', {
          method: 'POST',
          body: JSON.stringify({ qty: simpleQty, type: damageType, reason: damageReason }),
        });
        toast.success(`Logged ${simpleQty} damaged ${damageType.toLowerCase()} jars.`);
      }
      setActiveModal(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueMaterialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDistributorId) {
      toast.error('Please select an authorized manufacturing distributor.');
      return;
    }
    const selectedEntries = Object.entries(issueItems).filter(([_, qty]) => Number(qty) > 0);
    if (selectedEntries.length === 0) {
      toast.error('Please specify positive quantities for at least one raw material.');
      return;
    }
    setSubmitting(true);
    try {
      await fetchWithAuth('/inventory/raw-materials/issue', {
        method: 'POST',
        body: JSON.stringify({
          distributorId: issueDistributorId,
          items: selectedEntries.map(([code, qty]) => ({ materialCode: code, quantity: Number(qty) })),
          reference: issueReference.trim() || undefined,
          notes: issueNotes.trim() || undefined,
        }),
      });
      toast.success('Raw materials issued to manufacturing plant successfully!');
      setActiveModal(null);
      await Promise.all([loadRawMaterials(), loadData(true)]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue raw materials');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered distributors
  const filteredDistributors = useMemo(() => {
    return distributors.filter((d) => {
      const matchesSearch =
        !distSearch.trim() ||
        d.agencyName.toLowerCase().includes(distSearch.toLowerCase()) ||
        d.name.toLowerCase().includes(distSearch.toLowerCase()) ||
        d.phone.includes(distSearch) ||
        d.referralCode.toLowerCase().includes(distSearch.toLowerCase());

      const matchesStatus =
        distStatusFilter === 'ALL' ||
        d.status === distStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [distributors, distSearch, distStatusFilter]);

  // Derived selected distributor for transfer
  const selectedTransferDist = useMemo(() => {
    return distributors.find((d) => d.id === transferDistId);
  }, [distributors, transferDistId]);

  // Derived selected distributor for return
  const selectedReturnDist = useMemo(() => {
    return distributors.find((d) => d.id === returnDistId);
  }, [distributors, returnDistId]);

  if (loading) return <EdropsPageLoader fullPage />;

  const compAvailable = dashboard?.companyStock?.filledJars ?? 0;
  const compEmptyPool = dashboard?.companyStock?.emptyJars ?? 0;
  const compDamagedCount = dashboard?.companyStock?.damagedJars ?? 0;
  const netSummary = dashboard?.networkSummary;

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150 max-w-[1600px] mx-auto pb-12">
      {/* ─── CENTRAL INVENTORY HEADER & CONTROLS ─────────────────── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#16324F] tracking-tight">
              Central Inventory Control Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 ml-8">
            Authoritative real-time stock allocation, transfer ledger, and distributor network holding
          </p>
        </div>

        {/* Global Operational Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openTransferModal()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer to Distributor</span>
          </button>

          <button
            type="button"
            onClick={() => openReturnModal()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Receive Return</span>
          </button>

          <button
            type="button"
            onClick={openAdjustCompanyModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Adjust Stock</span>
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1677C8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 6-KPI AUTHORITATIVE ECOSYSTEM OVERVIEW ───────────────── */}
      <section className="grid gap-2.5 sm:gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {/* Available Stock (Company) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
            Company Available
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
              {compAvailable.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Jars</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Ready for transfer</span>
        </div>

        {/* With Distributors */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
            With Distributors
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#1677C8]">
              {(netSummary?.withDistributors ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Jars</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Across {netSummary?.activeDistributorsCount ?? 0} active hubs
          </span>
        </div>

        {/* Customer Holding */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
            Customer Holding
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-indigo-700">
              {(netSummary?.customerHolding ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Jars</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Active customer holding</span>
        </div>

        {/* Empty Return Pool */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
            Empty Return Pool
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-700">
              {(netSummary?.totalEmptyPool ?? compEmptyPool).toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Jars</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {compEmptyPool} plant · {netSummary?.distributorEmptyPool ?? 0} hubs
          </span>
        </div>

        {/* Damaged / Quarantine */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
            Damaged / Discarded
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-700">
              {(netSummary?.totalDamaged ?? compDamagedCount).toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Jars</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Out of circulation</span>
        </div>

        {/* Total Company Jars in Ecosystem */}
        <div className="bg-linear-to-br from-slate-900 to-[#16324F] p-3.5 rounded-2xl text-white shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block">
            Total Company Owned
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {(netSummary?.totalCompanyJarsInEcosystem ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-slate-300">Jars</span>
          </div>
          <span className="text-[10px] text-slate-300 block mt-1">Zero duplication balance</span>
        </div>
      </section>

      {/* ─── NAVIGATION TABS ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('COMPANY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'COMPANY'
              ? 'bg-[#16324F] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Company Stock</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DISTRIBUTORS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'DISTRIBUTORS'
              ? 'bg-[#16324F] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Distributor Stock ({distributors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('RAW_MATERIALS');
            loadRawMaterials();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'RAW_MATERIALS'
              ? 'bg-[#16324F] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Droplets className="w-4 h-4" />
          <span>Raw Materials & Mfg Issuance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'MOVEMENTS'
              ? 'bg-[#16324F] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement History</span>
        </button>
      </div>

      {/* ─── TAB 1: COMPANY STOCK ────────────────────────────────── */}
      {activeTab === 'COMPANY' && (
        <div className="space-y-4">
          {/* Product-level Company Stock Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#16324F] uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#1677C8]" />
                  Product Inventory Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Central warehouse inventory positions and active distribution allocation
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setActiveModal('PRODUCTION'); setSimpleQty(20); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Log Production</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveModal('REPLENISH'); setSimpleQty(50); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                  <span>Restock Warehouse</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveModal('DAMAGE'); setSimpleQty(1); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                  <span>Report Damage</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Deposit / Unit</th>
                    <th className="py-3 px-4 text-emerald-700">Warehouse Filled</th>
                    <th className="py-3 px-4 text-amber-700">Empty Return Pool</th>
                    <th className="py-3 px-4 text-rose-700">Damaged</th>
                    <th className="py-3 px-4 text-sky-700">With Distributors</th>
                    <th className="py-3 px-4 text-indigo-700">Customer Holding</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dashboard?.products && dashboard.products.length > 0 ? (
                    dashboard.products.map((prod: any) => (
                      <tr key={prod.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {prod.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">
                          ₹{prod.depositAmount ?? 200}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700 text-sm">
                          {prod.companyFilled.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-700 text-sm">
                          {prod.companyEmpty.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-rose-600">
                          {prod.companyDamaged.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-sky-700 text-sm">
                          {prod.withDistributors.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-700 text-sm">
                          {prod.withCustomers.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openTransferModal()}
                              className="px-2.5 py-1 bg-[#1677C8]/10 hover:bg-[#1677C8]/20 text-[#1677C8] font-bold rounded-lg text-[11px] transition cursor-pointer"
                            >
                              Transfer
                            </button>
                            <button
                              type="button"
                              onClick={() => openReturnModal()}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                            >
                              Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        No product catalog items configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: DISTRIBUTOR STOCK ────────────────────────────── */}
      {activeTab === 'DISTRIBUTORS' && (
        <div className="space-y-3.5">
          {/* Controls Bar */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={distSearch}
                onChange={(e) => setDistSearch(e.target.value)}
                placeholder="Search distributor agency, phone, code..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#1677C8]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500 font-semibold">Status:</span>
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl text-xs font-semibold">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDistStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      distStatusFilter === st
                        ? 'bg-white text-[#16324F] font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Distributors Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Distributor Hub</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-emerald-700">Available Filled</th>
                    <th className="py-3 px-4 text-amber-700">Empty Yard</th>
                    <th className="py-3 px-4 text-indigo-700">Customer Holding</th>
                    <th className="py-3 px-4 text-rose-700">Damaged</th>
                    <th className="py-3 px-4 font-extrabold text-[#16324F]">Total Jars</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDistributors.length > 0 ? (
                    filteredDistributors.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 text-sm">{d.agencyName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span>{d.name}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-600">{d.phone}</span>
                            {d.referralCode && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-700 font-bold">
                                  <span>{d.referralCode}</span>
                                  <CopyReferralCodeButton
                                    code={d.referralCode}
                                    iconClassName="w-2.5 h-2.5"
                                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                  />
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          <div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                d.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <div>
                            {d.canManufacture ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <Factory className="w-2.5 h-2.5" /> Mfg Plant
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                Dist Only
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 text-sm">
                          {d.companyOwned.available.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-amber-700 text-sm">
                          {d.companyOwned.empty.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-700 text-sm">
                          {d.companyOwned.customerHolding.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-rose-600">
                          {d.companyOwned.damaged.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-[#16324F] text-sm">
                            {d.totalManaged.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {d.companyOwnedJars ?? d.totalManaged} Co · {d.distributorOwnedJars ?? 0} Dist
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDistDetail(d)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                              title="View Details"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>

                            {d.canManufacture && (
                              <button
                                type="button"
                                onClick={() => openIssueMaterialsModal(d)}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                                title="Issue raw materials for manufacturing"
                              >
                                <Droplets className="w-3 h-3" />
                                <span>Issue Materials</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openTransferModal(d)}
                              className="px-2.5 py-1 bg-[#1677C8]/10 hover:bg-[#1677C8]/20 text-[#1677C8] font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                              title="Transfer stock to this distributor"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Transfer</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openReturnModal(d)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                              title="Receive stock return from this distributor"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Return</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openAdjustDistModal(d)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                              title="Adjust physically audited count"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>Adjust</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No distributors found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: RAW MATERIALS & MFG ISSUANCE ─────────────────── */}
      {activeTab === 'RAW_MATERIALS' && (
        <div className="space-y-4">
          {/* Header & Global Action */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#16324F] uppercase tracking-wider flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[#1677C8]" />
                Central Raw Material & Packaging Catalog
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Central storage inventory of caps, preforms, labels, and empty jars for manufacturing plants
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openIssueMaterialsModal()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Issue Materials to Plant</span>
              </button>
              <button
                type="button"
                onClick={() => loadRawMaterials()}
                disabled={rawLoading}
                className="inline-flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                title="Refresh Raw Materials"
              >
                <RefreshCw className={`w-4 h-4 ${rawLoading ? 'animate-spin text-[#1677C8]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Raw Materials Stock Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {rawMaterials.map((mat) => (
              <div key={mat.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                    {mat.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                    {mat.code}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl sm:text-2xl font-extrabold text-[#16324F]">
                    {mat.centralStock.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">{mat.unit}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>Issued: {mat.totalIssued.toLocaleString()}</span>
                  <span className={mat.centralStock < mat.minThreshold ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                    {mat.centralStock < mat.minThreshold ? 'Low Stock' : 'Optimal'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Raw Materials Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Raw Materials Master Ledger
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Material Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4 text-emerald-700">Central Warehouse Stock</th>
                    <th className="py-3 px-4 text-purple-700">Issued to Plants</th>
                    <th className="py-3 px-4 text-slate-500">Min Threshold</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {rawMaterials.length > 0 ? (
                    rawMaterials.map((mat) => (
                      <tr key={mat.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">{mat.name}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{mat.code}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {mat.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{mat.unit}</td>
                        <td className="py-3 px-4 font-extrabold text-emerald-700 text-sm">
                          {mat.centralStock.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-purple-700 text-sm">
                          {mat.totalIssued.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {mat.minThreshold.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openIssueMaterialsModal()}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                          >
                            Issue to Plant
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {rawLoading ? 'Loading raw materials...' : 'No raw materials configured.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Materials Movements Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Raw Materials Movement & Production Consumption Audit Trail
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4">Plant / Hub</th>
                    <th className="py-3 px-4 text-center">Quantity</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {rawMovements.length > 0 ? (
                    rawMovements.map((mov) => {
                      const isNegative = mov.movementType === 'PRODUCTION_CONSUMPTION' || mov.movementType === 'PRODUCTION_WASTAGE';
                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                            {new Date(mov.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {mov.movementType}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {mov.material?.name || 'Raw Material'} ({mov.material?.unit})
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-semibold">
                            {mov.distributor?.agencyName || 'Central Warehouse'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-sm">
                            {isNegative ? (
                              <span className="text-rose-600">-{mov.quantity}</span>
                            ) : (
                              <span className="text-emerald-600">+{mov.quantity}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {mov.balanceAfter.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {mov.reference && (
                              <span className="font-mono bg-slate-100 px-1 rounded mr-1">
                                {mov.reference}
                              </span>
                            )}
                            {mov.notes}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No raw material movements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: MOVEMENT HISTORY ─────────────────────────────── */}
      {activeTab === 'MOVEMENTS' && (
        <div className="space-y-3.5">
          {/* Filter Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={movSearch}
                  onChange={(e) => setMovSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadMovements(1, movDistFilter, movActionFilter, movSearch);
                  }}
                  placeholder="Search ref, description..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#1677C8]"
                />
              </div>

              <select
                value={movDistFilter}
                onChange={(e) => {
                  setMovDistFilter(e.target.value);
                  setMovPage(1);
                  loadMovements(1, e.target.value, movActionFilter, movSearch);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700"
              >
                <option value="ALL">All Hubs & Company</option>
                <option value="COMPANY">Company Warehouse Only</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.agencyName}
                  </option>
                ))}
              </select>

              <select
                value={movActionFilter}
                onChange={(e) => {
                  setMovActionFilter(e.target.value);
                  setMovPage(1);
                  loadMovements(1, movDistFilter, e.target.value, movSearch);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700"
              >
                <option value="ALL">All Transaction Actions</option>
                <option value="STOCK_TRANSFER">STOCK_TRANSFER</option>
                <option value="STOCK_RETURN">STOCK_RETURN</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="CUSTOMER_RETURN">CUSTOMER_RETURN</option>
                <option value="UNDELIVERED_RETURN">UNDELIVERED_RETURN</option>
                <option value="DELIVERY_COMPLETED">DELIVERY_COMPLETED</option>
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="REPLENISH">REPLENISH</option>
                <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT</option>
                <option value="DAMAGE_REMOVAL">DAMAGE_REMOVAL</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => loadMovements(1, movDistFilter, movActionFilter, movSearch)}
              className="px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Apply Filter
            </button>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">From → To</th>
                    <th className="py-3 px-4 text-center">Quantity</th>
                    <th className="py-3 px-4">Available After</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {movementsData.movements.length > 0 ? (
                    movementsData.movements.map((m) => {
                      const isPositive = m.quantity > 0;
                      const isZero = m.quantity === 0;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                            {new Date(m.timestamp).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {m.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{m.productName}</td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            <span className="font-semibold text-slate-700">{m.fromState}</span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="font-semibold text-slate-700">{m.toState}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-sm">
                            {isZero ? (
                              <span className="text-slate-400">0</span>
                            ) : isPositive ? (
                              <span className="text-emerald-600">+{m.quantity}</span>
                            ) : (
                              <span className="text-rose-600">{m.quantity}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {m.balanceAfter !== null ? `${m.balanceAfter} jars` : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {m.referenceId}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {m.performedBy}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No movement records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {movementsData.pagination.totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing page {movementsData.pagination.page} of {movementsData.pagination.totalPages} ({movementsData.pagination.total} entries)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={movementsData.pagination.page <= 1}
                    onClick={() => {
                      const prev = movementsData.pagination.page - 1;
                      setMovPage(prev);
                      loadMovements(prev, movDistFilter, movActionFilter, movSearch);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={movementsData.pagination.page >= movementsData.pagination.totalPages}
                    onClick={() => {
                      const next = movementsData.pagination.page + 1;
                      setMovPage(next);
                      loadMovements(next, movDistFilter, movActionFilter, movSearch);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: TRANSFER TO DISTRIBUTOR ─────────────────────── */}
      <AnimatePresence>
        {activeModal === 'TRANSFER' && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
                    <ArrowRightLeft className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">Transfer Stock to Distributor</h3>
                    <p className="text-xs text-slate-500">Atomic allocation from central company warehouse</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Distributor Hub</label>
                  <select
                    value={transferDistId}
                    onChange={(e) => setTransferDistId(e.target.value)}
                    required
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-[#1677C8]"
                  >
                    {distributors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.agencyName} ({d.referralCode}) — Current Available: {d.companyOwned.available} jars
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Company Available</label>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-extrabold text-sm">
                      {compAvailable.toLocaleString()} Jars
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Quantity</label>
                    <input
                      type="number"
                      min={1}
                      max={compAvailable}
                      value={transferQty}
                      onChange={(e) => setTransferQty(Number(e.target.value))}
                      required
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-[#1677C8]"
                    />
                  </div>
                </div>

                {/* Dynamic Preview */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    After Transfer Projection
                  </span>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Company Stock:</span>
                    <span className="font-bold text-emerald-700">
                      {compAvailable} → {Math.max(0, compAvailable - transferQty)} jars
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Distributor Stock:</span>
                    <span className="font-bold text-[#1677C8]">
                      {selectedTransferDist?.companyOwned?.available ?? 0} →{' '}
                      {(selectedTransferDist?.companyOwned?.available ?? 0) + Number(transferQty)} jars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Optional Notes</label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Batch, vehicle number, or driver note"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-[#1677C8]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || transferQty <= 0 || transferQty > compAvailable}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#125ea0] rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Transferring...' : 'Confirm Transfer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: RECEIVE RETURN FROM DISTRIBUTOR ─────────────── */}
      <AnimatePresence>
        {activeModal === 'RETURN' && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <RotateCcw className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">Receive Return from Distributor</h3>
                    <p className="text-xs text-slate-500">Atomic stock return into central warehouse pool</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReturnSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Distributor Hub</label>
                  <select
                    value={returnDistId}
                    onChange={(e) => setReturnDistId(e.target.value)}
                    required
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emerald-600"
                  >
                    {distributors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.agencyName} ({d.referralCode}) — Empty: {d.companyOwned.empty}, Filled: {d.companyOwned.available}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Return Stock Type</label>
                    <select
                      value={returnType}
                      onChange={(e) => setReturnType(e.target.value as any)}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="EMPTY">Empty Jars (To Return Pool)</option>
                      <option value="FILLED">Filled Jars (To Filled Pool)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Return Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={returnQty}
                      onChange={(e) => setReturnQty(Number(e.target.value))}
                      required
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Dynamic Preview */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    After Return Projection
                  </span>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Distributor {returnType === 'EMPTY' ? 'Empty Yard' : 'Filled Yard'}:</span>
                    <span className="font-bold text-amber-700">
                      {returnType === 'EMPTY'
                        ? selectedReturnDist?.companyOwned?.empty ?? 0
                        : selectedReturnDist?.companyOwned?.available ?? 0}{' '}
                      →{' '}
                      {Math.max(
                        0,
                        (returnType === 'EMPTY'
                          ? selectedReturnDist?.companyOwned?.empty ?? 0
                          : selectedReturnDist?.companyOwned?.available ?? 0) - returnQty,
                      )}{' '}
                      jars
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Company Central Pool:</span>
                    <span className="font-bold text-emerald-700">
                      {returnType === 'EMPTY' ? compEmptyPool : compAvailable} →{' '}
                      {(returnType === 'EMPTY' ? compEmptyPool : compAvailable) + Number(returnQty)} jars
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Optional Notes</label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Batch code, driver name, collection receipt"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || returnQty <= 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Processing...' : 'Confirm Return'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: ADJUST DISTRIBUTOR STOCK ─────────────────────── */}
      <AnimatePresence>
        {activeModal === 'ADJUST_DISTRIBUTOR' && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                    <SlidersHorizontal className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">Adjust Distributor Stock</h3>
                    <p className="text-xs text-slate-500">
                      Physical audit correction for {selectedDistributor?.agencyName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdjustDistSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Stock State</label>
                  <select
                    value={adjustState}
                    onChange={(e) => {
                      const st = e.target.value as any;
                      setAdjustState(st);
                      if (st === 'FILLED_YARD') setAdjustNewQty(selectedDistributor?.companyOwned?.available ?? 0);
                      else if (st === 'EMPTY_YARD') setAdjustNewQty(selectedDistributor?.companyOwned?.empty ?? 0);
                      else if (st === 'DAMAGED') setAdjustNewQty(selectedDistributor?.companyOwned?.damaged ?? 0);
                    }}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="FILLED_YARD">Filled Yard (Available)</option>
                    <option value="EMPTY_YARD">Empty Yard (Return Pool)</option>
                    <option value="DAMAGED">Damaged / Quarantine</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current in System</label>
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-extrabold text-sm">
                      {adjustState === 'FILLED_YARD'
                        ? selectedDistributor?.companyOwned?.available ?? 0
                        : adjustState === 'EMPTY_YARD'
                        ? selectedDistributor?.companyOwned?.empty ?? 0
                        : selectedDistributor?.companyOwned?.damaged ?? 0}{' '}
                      jars
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">New Verified Count</label>
                    <input
                      type="number"
                      min={0}
                      value={adjustNewQty}
                      onChange={(e) => setAdjustNewQty(Number(e.target.value))}
                      required
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mandatory Reason <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    required
                    placeholder="e.g., Physical count discrepancy, damaged during route"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !adjustReason.trim()}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Applying...' : 'Apply Adjustment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: ADJUST COMPANY STOCK ────────────────────────── */}
      <AnimatePresence>
        {activeModal === 'ADJUST_COMPANY' && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                    <SlidersHorizontal className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">Adjust Company Warehouse Stock</h3>
                    <p className="text-xs text-slate-500">Audited physical reconciliation of central plant counts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdjustCompanySubmit} className="space-y-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-emerald-700 mb-1">Filled Jars</label>
                    <input
                      type="number"
                      min={0}
                      value={compFilled}
                      onChange={(e) => setCompFilled(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1">Empty Jars</label>
                    <input
                      type="number"
                      min={0}
                      value={compEmpty}
                      onChange={(e) => setCompEmpty(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-rose-700 mb-1">Damaged</label>
                    <input
                      type="number"
                      min={0}
                      value={compDamaged}
                      onChange={(e) => setCompDamaged(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-rose-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mandatory Reason <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                    required
                    placeholder="e.g., Annual warehouse physical count audit"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-slate-700"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !compReason.trim()}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#16324F] hover:bg-[#122538] rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Applying...' : 'Apply Central Adjustment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: SIMPLE OPERATIONS (PRODUCTION / REPLENISH / DAMAGE) */}
      <AnimatePresence>
        {(activeModal === 'PRODUCTION' || activeModal === 'REPLENISH' || activeModal === 'DAMAGE') && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span
                    className={`p-1.5 rounded-lg ${
                      activeModal === 'PRODUCTION'
                        ? 'bg-emerald-50 text-emerald-700'
                        : activeModal === 'REPLENISH'
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {activeModal === 'PRODUCTION' ? (
                      <Plus className="w-5 h-5" />
                    ) : activeModal === 'REPLENISH' ? (
                      <RefreshCw className="w-5 h-5" />
                    ) : (
                      <AlertOctagon className="w-5 h-5" />
                    )}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">
                      {activeModal === 'PRODUCTION'
                        ? 'Log Plant Production'
                        : activeModal === 'REPLENISH'
                        ? 'Restock Warehouse'
                        : 'Report Damaged Jars'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeModal === 'PRODUCTION'
                        ? 'Converts warehouse empty jars into filled stock'
                        : activeModal === 'REPLENISH'
                        ? 'Adds newly filled jars into warehouse stock'
                        : 'Removes defective jars from active circulation'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSimpleOpsSubmit} className="space-y-3.5">
                {activeModal === 'DAMAGE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Damaged Stock Type</label>
                    <select
                      value={damageType}
                      onChange={(e) => setDamageType(e.target.value as any)}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    >
                      <option value="FILLED">Filled Jar</option>
                      <option value="EMPTY">Empty Jar</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {activeModal === 'PRODUCTION'
                      ? 'Jars to Manufacture (Empty -> Filled)'
                      : 'Quantity of Jars'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={simpleQty}
                    onChange={(e) => setSimpleQty(Number(e.target.value))}
                    required
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-1 focus:ring-[#1677C8]"
                  />
                  {activeModal === 'PRODUCTION' && (
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Available Empty Return Pool: {compEmptyPool} jars
                    </span>
                  )}
                </div>

                {activeModal === 'DAMAGE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Damage Reason</label>
                    <input
                      type="text"
                      value={damageReason}
                      onChange={(e) => setDamageReason(e.target.value)}
                      placeholder="e.g., Cracked neck, contaminated, leakage"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || simpleQty <= 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#125ea0] rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: DISTRIBUTOR DETAIL & MOVEMENTS ───────────────── */}
      <AnimatePresence>
        {activeModal === 'DIST_DETAIL' && selectedDistributor && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">
                      {selectedDistributor.agencyName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span>{selectedDistributor.name}</span>
                      <span>•</span>
                      <span>{selectedDistributor.phone}</span>
                      {selectedDistributor.referralCode && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            <span>{selectedDistributor.referralCode}</span>
                            <CopyReferralCodeButton
                              code={selectedDistributor.referralCode}
                              iconClassName="w-2.5 h-2.5"
                              className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            />
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {distDetailLoading ? (
                <div className="py-8 text-center text-slate-400">Loading distributor details...</div>
              ) : (
                <div className="space-y-4">
                  {/* Stock Position Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Available Filled
                      </span>
                      <span className="text-xl font-extrabold text-emerald-800 mt-1 block">
                        {selectedDistributor.companyOwned.available} jars
                      </span>
                    </div>

                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                        Empty Yard Pool
                      </span>
                      <span className="text-xl font-extrabold text-amber-800 mt-1 block">
                        {selectedDistributor.companyOwned.empty} jars
                      </span>
                    </div>

                    <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                        Customer Holding
                      </span>
                      <span className="text-xl font-extrabold text-indigo-800 mt-1 block">
                        {selectedDistributor.companyOwned.customerHolding} jars
                      </span>
                    </div>

                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                        Total Entrusted
                      </span>
                      <span className="text-xl font-extrabold text-slate-800 mt-1 block">
                        {selectedDistributor.totalManaged} jars
                      </span>
                    </div>
                  </div>

                  {/* Recent Activity for this Distributor */}
                  <div>
                    <h4 className="text-xs font-bold text-[#16324F] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-[#1677C8]" />
                      Recent Stock Movements
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Action</th>
                            <th className="py-2 px-3">From → To</th>
                            <th className="py-2 px-3 text-center">Qty</th>
                            <th className="py-2 px-3">Available After</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {distDetailData?.recentMovements && distDetailData.recentMovements.length > 0 ? (
                            distDetailData.recentMovements.map((m: any) => (
                              <tr key={m.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                                  {new Date(m.timestamp).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-700">{m.action}</td>
                                <td className="py-2 px-3 text-[11px] text-slate-500">
                                  {m.fromState} → {m.toState}
                                </td>
                                <td className="py-2 px-3 text-center font-bold">
                                  {m.quantity > 0 ? (
                                    <span className="text-emerald-600">+{m.quantity}</span>
                                  ) : m.quantity < 0 ? (
                                    <span className="text-rose-600">{m.quantity}</span>
                                  ) : (
                                    <span className="text-slate-400">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-700">
                                  {m.balanceAfter !== null ? `${m.balanceAfter} jars` : '—'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-slate-400">
                                No movements recorded yet for this hub.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openTransferModal(selectedDistributor)}
                      className="px-3 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Transfer Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => openReturnModal(selectedDistributor)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Receive Return
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ─── MODAL: ISSUE RAW MATERIALS ────────────────────────── */}
        {activeModal === 'ISSUE_MATERIALS' && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                    <Factory className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#16324F]">Issue Raw Materials to Plant</h3>
                    <p className="text-xs text-slate-500">Atomic allocation from central inventory to manufacturing distributor</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleIssueMaterialsSubmit} className="space-y-4">
                {/* Target Manufacturing Distributor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Authorized Manufacturing Plant <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={issueDistributorId}
                    onChange={(e) => setIssueDistributorId(e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-600"
                  >
                    <option value="" disabled>Select manufacturing hub...</option>
                    {distributors.filter((d) => d.canManufacture).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.agencyName} ({d.name}) — {d.phone} [Authorized Mfg Plant]
                      </option>
                    ))}
                  </select>
                  {distributors.filter((d) => d.canManufacture).length === 0 && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      No distributors are authorized for manufacturing. Enable manufacturing permission first.
                    </p>
                  )}
                </div>

                {/* Materials Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Materials & Quantities to Dispatch <span className="text-rose-500">*</span>
                  </label>
                  <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    {rawMaterials.map((mat) => (
                      <div key={mat.id} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800">{mat.name}</div>
                          <div className="text-[10px] text-slate-500">
                            Central Stock: <span className="font-bold text-emerald-700">{mat.centralStock.toLocaleString()} {mat.unit}</span> · Code: {mat.code}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max={mat.centralStock}
                            placeholder="0"
                            value={issueItems[mat.code] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                              setIssueItems((prev) => ({ ...prev, [mat.code]: val }));
                            }}
                            className="w-24 text-right px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-600"
                          />
                          <span className="text-xs text-slate-500 w-10">{mat.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reference & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dispatch Ref / Challan # (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DC-2026-0042"
                      value={issueReference}
                      onChange={(e) => setIssueReference(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Notes / Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. For weekly 20L production run"
                      value={issueNotes}
                      onChange={(e) => setIssueNotes(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-900 flex items-start gap-2">
                  <Factory className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    Issuing materials automatically decrements Central Warehouse stock and increments the authorized distributor's raw material ledger in an atomic PostgreSQL transaction.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Issuing Materials...' : 'Confirm Issuance & Decrement Stock'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
