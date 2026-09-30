import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  Droplets,
  Factory,
  ImagePlus,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { fetchWithAuth } from "../../../api/client";
import { useSocket } from "../../../contexts/SocketContext";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { DistributorTopbar } from "../components/DistributorTopbar";
import { ReportKpiCard } from "../components/reports/ReportKpiCard";
import { InventoryTransactions } from "../components/InventoryTransactions";

export type JarInventoryItemRecord = {
  id: string;
  name: string;
  ownershipType: "COMPANY" | "DISTRIBUTOR";
  imageUrl: string | null;
  description: string | null;
  ownedQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  filledYardQuantity?: number;
  emptyYardQuantity?: number;
  customerQuantity?: number;
  washingQuantity?: number;
  fillingQuantity?: number;
  quarantineQuantity?: number;
  damagedQuantity?: number;
  lostQuantity?: number;
  isActive: boolean;
};

type PhysicalBreakdown = {
  filledYard: number;
  emptyYard: number;
  withCustomers: number;
  washing: number;
  filling: number;
  quarantine: number;
  damaged: number;
  lost: number;
};

type Stock = {
  total: number;
  reserved?: number;
  available: number | null;
  filledYard?: number;
  emptyYard?: number;
  withCustomers?: number | null;
  washing?: number;
  filling?: number;
  quarantine?: number;
  damaged?: number | null;
  lost?: number;
};

type InventoryData = {
  total: number;
  companyOwned: Stock;
  distributorOwned: Stock & { imageUrl: string | null };
  items?: JarInventoryItemRecord[];
};

type ReconciliationData = {
  distributorId: string;
  companyOwned: {
    ownedQuantity: number;
    physicalTotal: number;
    variance: number;
    isReconciled: boolean;
    breakdown: PhysicalBreakdown;
  };
  distributorOwned: {
    ownedQuantity: number;
    physicalTotal: number;
    variance: number;
    isReconciled: boolean;
    breakdown: PhysicalBreakdown;
  };
  overallReconciled: boolean;
};

export const inventoryQuantity = (value: number | null | undefined) =>
  value === null || value === undefined ? "0" : value.toLocaleString();

const button =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#1677C8]";

const PHYSICAL_STATES = [
  { value: "FILLED_YARD", label: "Filled in Yard", icon: Droplets, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "EMPTY_YARD", label: "Empty in Yard", icon: Boxes, color: "text-slate-700 bg-slate-50 border-slate-200" },
  { value: "CUSTOMER", label: "With Customers", icon: UserCheck, color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "WASHING", label: "Washing & Cleaning", icon: Factory, color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  { value: "FILLING", label: "Water Filling", icon: Droplets, color: "text-sky-700 bg-sky-50 border-sky-200" },
  { value: "QUARANTINE", label: "Quarantine / QC", icon: AlertTriangle, color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "DAMAGED", label: "Damaged / Scrapped", icon: AlertCircle, color: "text-rose-700 bg-rose-50 border-rose-200" },
] as const;

export default function Inventory() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // Add Jar Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addQuantity, setAddQuantity] = useState("0");
  const [addDescription, setAddDescription] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addPreview, setAddPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Move Jars Modal State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveJarItemId, setMoveJarItemId] = useState<string>("");
  const [moveFromState, setMoveFromState] = useState<string>("EMPTY_YARD");
  const [moveToState, setMoveToState] = useState<string>("WASHING");
  const [moveQuantity, setMoveQuantity] = useState<string>("1");
  const [moveReason, setMoveReason] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);

  // Quick Customer Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnJarItemId, setReturnJarItemId] = useState<string>("");
  const [returnQuantity, setReturnQuantity] = useState<string>("1");
  const [returnState, setReturnState] = useState<string>("EMPTY_YARD");
  const [returnReason, setReturnReason] = useState<string>("");
  const [isReturning, setIsReturning] = useState(false);

  // Card Image Edit State
  const [activeUploadItemId, setActiveUploadItemId] = useState<string | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const request = useRef(0);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const [invRes, reconRes] = await Promise.all([
        fetchWithAuth("/distributor/inventory"),
        fetchWithAuth("/distributor/inventory/reconciliation").catch(() => null),
      ]);
      if (id !== request.current) return;
      setData(invRes);
      if (reconRes) setReconciliation(reconRes);
      setError("");
      setRevision((value) => value + 1);
    } catch (err) {
      if (id === request.current)
        setError(
          err instanceof Error ? err.message : "Unable to load inventory.",
        );
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 300);
    };
    socket?.on("ORDER_STATUS_CHANGED", refresh);
    socket?.on("order:updated", refresh);
    socket?.on("inventory:updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      socket?.off("ORDER_STATUS_CHANGED", refresh);
      socket?.off("order:updated", refresh);
      socket?.off("inventory:updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [socket, load]);

  // Preview management for Add Modal
  useEffect(() => {
    if (!addFile) {
      setAddPreview(null);
      return;
    }
    const url = URL.createObjectURL(addFile);
    setAddPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [addFile]);

  // Preview management for Edit Card
  useEffect(() => {
    if (!editFile) {
      setEditPreview(null);
      return;
    }
    const url = URL.createObjectURL(editFile);
    setEditPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editFile]);

  const handleOpenAddModal = () => {
    setAddName("");
    setAddQuantity("0");
    setAddDescription("");
    setAddFile(null);
    setAddPreview(null);
    setIsAddModalOpen(true);
  };

  const handleOpenMoveModal = (itemId?: string, defaultFrom?: string, defaultTo?: string) => {
    const allItems = data?.items || [];
    const targetItem = itemId ? allItems.find((i) => i.id === itemId) : allItems[0];
    setMoveJarItemId(targetItem?.id || allItems[0]?.id || "");
    setMoveFromState(defaultFrom || "EMPTY_YARD");
    setMoveToState(defaultTo || "WASHING");
    setMoveQuantity("1");
    setMoveReason("");
    setIsMoveModalOpen(true);
  };

  const handleOpenReturnModal = (itemId?: string) => {
    const allItems = data?.items || [];
    const targetItem = itemId ? allItems.find((i) => i.id === itemId) : allItems[0];
    setReturnJarItemId(targetItem?.id || allItems[0]?.id || "");
    setReturnQuantity("1");
    setReturnState("EMPTY_YARD");
    setReturnReason("");
    setIsReturnModalOpen(true);
  };

  const handleCreateJarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      toast.error("Please enter a jar name.");
      return;
    }
    if (!addFile) {
      toast.error("Please upload an image of the jar.");
      return;
    }

    try {
      setIsCreating(true);
      const formData = new FormData();
      formData.append("name", addName.trim());
      formData.append("openingQuantity", String(Math.max(0, parseInt(addQuantity, 10) || 0)));
      if (addDescription.trim()) {
        formData.append("description", addDescription.trim());
      }
      formData.append("file", addFile);

      await fetchWithAuth("/distributor/inventory/items", {
        method: "POST",
        body: formData,
      });

      toast.success("Distributor jar item created successfully.");
      setIsAddModalOpen(false);
      void load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to create distributor jar item.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleMoveJarsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(moveQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid jar quantity to move.");
      return;
    }
    if (moveFromState === moveToState) {
      toast.error("Source and destination states must be different.");
      return;
    }

    try {
      setIsMoving(true);
      await fetchWithAuth("/distributor/inventory/move", {
        method: "POST",
        body: JSON.stringify({
          jarItemId: moveJarItemId,
          fromState: moveFromState,
          toState: moveToState,
          quantity: qty,
          reason: moveReason.trim() || undefined,
        }),
      });

      toast.success(`Successfully moved ${qty} jars from ${moveFromState} to ${moveToState}.`);
      setIsMoveModalOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move jars.");
    } finally {
      setIsMoving(false);
    }
  };

  const handleCustomerReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(returnQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid returned jar quantity.");
      return;
    }

    try {
      setIsReturning(true);
      await fetchWithAuth("/distributor/inventory/customer-return", {
        method: "POST",
        body: JSON.stringify({
          jarItemId: returnJarItemId,
          quantity: qty,
          returnState,
          reason: returnReason.trim() || undefined,
        }),
      });

      toast.success(`Recorded return of ${qty} empty jars into ${returnState}.`);
      setIsReturnModalOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record customer return.");
    } finally {
      setIsReturning(false);
    }
  };

  const handleSaveItemImage = async (itemId: string) => {
    if (!editFile) return;
    setIsUpdatingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", editFile);
      await fetchWithAuth(`/distributor/inventory/items/${itemId}/image`, {
        method: "POST",
        body: formData,
      });
      toast.success("Jar image updated successfully.");
      setEditFile(null);
      setActiveUploadItemId(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to update jar image.",
      );
    } finally {
      setIsUpdatingImage(false);
    }
  };

  // Company and Distributor items
  const companyItem = data?.items?.find((i) => i.ownershipType === "COMPANY");
  const distributorItems = data?.items?.filter((i) => i.ownershipType === "DISTRIBUTOR") || [];

  const companyOwnedStock: Stock = {
    total: companyItem ? companyItem.ownedQuantity : data?.companyOwned.total || 0,
    reserved: companyItem ? companyItem.reservedQuantity : data?.companyOwned.reserved || 0,
    available: companyItem ? companyItem.availableQuantity : data?.companyOwned.available ?? 0,
    filledYard: companyItem?.filledYardQuantity ?? data?.companyOwned.filledYard ?? 0,
    emptyYard: companyItem?.emptyYardQuantity ?? data?.companyOwned.emptyYard ?? 0,
    withCustomers: companyItem?.customerQuantity ?? data?.companyOwned.withCustomers ?? 0,
    washing: companyItem?.washingQuantity ?? data?.companyOwned.washing ?? 0,
    filling: companyItem?.fillingQuantity ?? data?.companyOwned.filling ?? 0,
    quarantine: companyItem?.quarantineQuantity ?? data?.companyOwned.quarantine ?? 0,
    damaged: companyItem?.damagedQuantity ?? data?.companyOwned.damaged ?? 0,
    lost: companyItem?.lostQuantity ?? data?.companyOwned.lost ?? 0,
  };

  const distributorOwnedStockTotal = distributorItems.length > 0
    ? distributorItems.reduce((acc, i) => acc + i.ownedQuantity, 0)
    : data?.distributorOwned.total || 0;

  const distributorOwnedAvailableTotal = distributorItems.length > 0
    ? distributorItems.reduce((acc, i) => acc + i.availableQuantity, 0)
    : data?.distributorOwned.available ?? 0;

  const totalOwnedKpi = companyOwnedStock.total + distributorOwnedStockTotal;
  const availableForDispatchKpi = (companyOwnedStock.available ?? 0) + (distributorOwnedAvailableTotal ?? 0);

  // Helper for physical breakdown item
  const getSelectedMoveItemCurrentStock = () => {
    const item = data?.items?.find((i) => i.id === moveJarItemId);
    if (!item) return 0;
    switch (moveFromState) {
      case "FILLED_YARD": return item.filledYardQuantity ?? 0;
      case "EMPTY_YARD": return item.emptyYardQuantity ?? 0;
      case "CUSTOMER": return item.customerQuantity ?? 0;
      case "WASHING": return item.washingQuantity ?? 0;
      case "FILLING": return item.fillingQuantity ?? 0;
      case "QUARANTINE": return item.quarantineQuantity ?? 0;
      case "DAMAGED": return item.damagedQuantity ?? 0;
      default: return 0;
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] animate-in fade-in duration-150">
      <DistributorTopbar
        title="Distributor Inventory"
        subtitle="Authoritative ownership ledger and physical jar location breakdown."
        icon={Boxes}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
              onClick={() => handleOpenMoveModal()}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Move Jars
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
              onClick={() => handleOpenReturnModal()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Customer Return
            </button>
            <button
              className={button}
              onClick={handleOpenAddModal}
            >
              <Plus className="h-3.5 w-3.5 text-[#1677C8]" />
              Add Brand
            </button>
            <button
              className={button}
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        }
      />

      <div className="w-full p-3.5 sm:p-6 space-y-5 flex-1">
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-2xs"
          >
            <span>{error}</span>
            <button className={button} onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {!data && loading ? (
          <LoadingSpinner label="Loading authoritative inventory ledger..." />
        ) : (
          data && (
            <>
              {/* ─── SECTION 1: MASTER OWNERSHIP OVERVIEW ─────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    1. Authoritative Jar Ownership
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Ownership is master · Physical locations reconcile to total owned
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <ReportKpiCard
                    label="Total Owned Jars"
                    value={inventoryQuantity(totalOwnedKpi)}
                    icon={Boxes}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Company Owned"
                    value={inventoryQuantity(companyOwnedStock.total)}
                    icon={Building2}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Distributor Owned"
                    value={inventoryQuantity(distributorOwnedStockTotal)}
                    icon={Package}
                    colorVariant="blue"
                  />
                  <ReportKpiCard
                    label="Available for Dispatch"
                    value={inventoryQuantity(availableForDispatchKpi)}
                    icon={Droplets}
                    colorVariant="emerald"
                  />
                </div>
              </div>

              {/* ─── RECONCILIATION INVARIANT BANNER ────────────────────── */}
              <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                reconciliation?.overallReconciled !== false
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                  : "bg-amber-50/90 border-amber-300 text-amber-900"
              }`}>
                <div className="flex items-center gap-2.5">
                  {reconciliation?.overallReconciled !== false ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold leading-tight">
                      {reconciliation?.overallReconciled !== false
                        ? "Physical Stock Invariant Verified · 100% Reconciled"
                        : "Inventory Variance Warning"}
                    </h4>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {reconciliation?.overallReconciled !== false
                        ? `Sum of all physical locations strictly equals owned inventory (${totalOwnedKpi} jars). Variance: 0`
                        : "Discrepancy detected between recorded ownership and physical location balances. Review logs."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-lg bg-white/80 border border-current text-[11px]">
                    Company Variance: {reconciliation?.companyOwned.variance ?? 0}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/80 border border-current text-[11px]">
                    Distributor Variance: {reconciliation?.distributorOwned.variance ?? 0}
                  </span>
                </div>
              </div>

              {/* ─── SECTION 2: COMPANY OWNED BREAKDOWN ────────────────── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Company Owned Physical Breakdown
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenMoveModal(companyItem?.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#1677C8] hover:text-[#1264A8] cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Move Jars
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleOpenReturnModal(companyItem?.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Customer Return
                    </button>
                  </div>
                </div>

                <div className="w-full bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-[#E2E8F0] bg-gradient-to-r from-slate-50 via-white to-sky-50/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
                        <img
                          src="/images/biodrops-jar.png"
                          alt="Biodrops 20L jar"
                          className="h-9 w-9 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#16324F]">
                            {companyItem?.name || "BioDrops 20L Returnable Jar"}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            Company Owned
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Standard BioDrops returnable assets · Custody changes do not change legal ownership
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Total Owned</span>
                        <span className="text-base font-black text-[#16324F] tabular-nums">
                          {companyOwnedStock.total.toLocaleString()} jars
                        </span>
                      </div>
                      <div className="pl-3 border-l border-slate-200">
                        <span className="block text-[10px] uppercase font-bold text-emerald-600">Available to Dispatch</span>
                        <span className="text-base font-black text-emerald-700 tabular-nums">
                          {(companyOwnedStock.available ?? 0).toLocaleString()} jars
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Physical States Grid */}
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 bg-[#FAFBFC] border-b border-[#E2E8F0]">
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-emerald-700">
                        <span className="text-[10px] uppercase font-bold">Filled in Yard</span>
                        <Droplets className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-lg font-black text-emerald-700 tabular-nums">
                        {(companyOwnedStock.filledYard ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">
                        {(companyOwnedStock.reserved ?? 0) > 0 ? `${companyOwnedStock.reserved} reserved` : "0 reserved"}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-[10px] uppercase font-bold">Empty in Yard</span>
                        <Boxes className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-lg font-black text-slate-800 tabular-nums">
                        {(companyOwnedStock.emptyYard ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">Awaiting washing</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-blue-700">
                        <span className="text-[10px] uppercase font-bold">With Customers</span>
                        <UserCheck className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-lg font-black text-blue-700 tabular-nums">
                        {(companyOwnedStock.withCustomers ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">In customer custody</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-cyan-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-cyan-700">
                        <span className="text-[10px] uppercase font-bold">Washing</span>
                        <Factory className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-lg font-black text-cyan-700 tabular-nums">
                        {(companyOwnedStock.washing ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">In cleaning cycle</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-sky-700">
                        <span className="text-[10px] uppercase font-bold">Filling</span>
                        <Droplets className="w-3.5 h-3.5 text-sky-600" />
                      </div>
                      <p className="text-lg font-black text-sky-700 tabular-nums">
                        {(companyOwnedStock.filling ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">At filling line</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-amber-700">
                        <span className="text-[10px] uppercase font-bold">Quarantine / QC</span>
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-lg font-black text-amber-700 tabular-nums">
                        {(companyOwnedStock.quarantine ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">Under inspection</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-rose-700">
                        <span className="text-[10px] uppercase font-bold">Damaged</span>
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-lg font-black text-rose-700 tabular-nums">
                        {(companyOwnedStock.damaged ?? 0).toLocaleString()}
                      </p>
                      <span className="block text-[10px] text-slate-400">Non-reusable jars</span>
                    </div>
                  </div>

                  {/* Mathematical Reconciliation Summary */}
                  <div className="px-4 py-2.5 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        ∑ ({companyOwnedStock.filledYard ?? 0} Filled + {companyOwnedStock.emptyYard ?? 0} Empty + {companyOwnedStock.withCustomers ?? 0} Customer + {companyOwnedStock.washing ?? 0} Wash + {companyOwnedStock.filling ?? 0} Fill + {companyOwnedStock.quarantine ?? 0} QC + {companyOwnedStock.damaged ?? 0} Dmg) = <strong>{companyOwnedStock.total} Owned Jars</strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === "COMPANY_OWNED" ? null : "COMPANY_OWNED")}
                      className="inline-flex items-center gap-1 font-semibold text-[#1677C8] hover:underline cursor-pointer"
                    >
                      {expanded === "COMPANY_OWNED" ? "Hide ledger transactions" : "View ledger transactions"}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-150 ${expanded === "COMPANY_OWNED" ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Expandable Transaction Ledger */}
                  {expanded === "COMPANY_OWNED" && (
                    <div className="border-t border-[#E2E8F0]">
                      <InventoryTransactions
                        ownership="COMPANY_OWNED"
                        jarItemId={companyItem?.id}
                        revision={revision}
                        stock={{
                          total: companyOwnedStock.total,
                          available: companyOwnedStock.available,
                          reserved: companyOwnedStock.reserved,
                          withCustomers: companyOwnedStock.withCustomers ?? null,
                          damaged: companyOwnedStock.damaged ?? null,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ─── SECTION 3: DISTRIBUTOR OWNED BREAKDOWN ───────────── */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Distributor Owned Physical Breakdown
                  </h3>
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1677C8] hover:text-[#1264A8] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Register New Brand
                  </button>
                </div>

                {distributorItems.length === 0 ? (
                  <div className="p-8 bg-white border border-[#E2E8F0] rounded-xl text-center space-y-3 shadow-2xs">
                    <div className="flex justify-center">
                      <span className="p-3 bg-slate-50 border border-slate-200 rounded-full text-slate-400">
                        <Package className="h-6 w-6" />
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        No distributor-owned jar items registered.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Add your distributor-owned or custom branded returnable jars to track separate physical locations and dispatches.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Distributor Jar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {distributorItems.map((item) => {
                      const open = expanded === item.id;
                      const image =
                        activeUploadItemId === item.id && editPreview
                          ? editPreview
                          : item.imageUrl;

                      return (
                        <div
                          key={item.id}
                          className="w-full bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden"
                        >
                          <div className="p-4 border-b border-[#E2E8F0] bg-gradient-to-r from-slate-50 via-white to-purple-50/20 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E2E8F0] overflow-hidden shadow-2xs">
                                {image ? (
                                  <img
                                    src={image}
                                    alt={item.name}
                                    className="h-10 w-10 object-contain"
                                  />
                                ) : (
                                  <ImagePlus className="h-5 w-5 text-slate-400" />
                                )}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-[#16324F]">
                                    {item.name}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    Distributor Owned
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {item.description || "Distributor-owned 20L returnable jar asset"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <span className="block text-[10px] uppercase font-bold text-slate-400">Total Owned</span>
                                <span className="text-base font-black text-[#16324F] tabular-nums">
                                  {item.ownedQuantity.toLocaleString()} jars
                                </span>
                              </div>
                              <div className="pl-3 border-l border-slate-200">
                                <span className="block text-[10px] uppercase font-bold text-emerald-600">Available to Dispatch</span>
                                <span className="text-base font-black text-emerald-700 tabular-nums">
                                  {item.availableQuantity.toLocaleString()} jars
                                </span>
                              </div>
                              <div className="pl-2 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMoveModal(item.id)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                  <ArrowRightLeft className="w-3 h-3" /> Move
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReturnModal(item.id)}
                                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" /> Return
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Physical States Grid */}
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 bg-[#FAFBFC] border-b border-[#E2E8F0]">
                            <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-emerald-700">
                                <span className="text-[10px] uppercase font-bold">Filled in Yard</span>
                                <Droplets className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-lg font-black text-emerald-700 tabular-nums">
                                {(item.filledYardQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">
                                {item.reservedQuantity > 0 ? `${item.reservedQuantity} reserved` : "0 reserved"}
                              </span>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-slate-700">
                                <span className="text-[10px] uppercase font-bold">Empty in Yard</span>
                                <Boxes className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <p className="text-lg font-black text-slate-800 tabular-nums">
                                {(item.emptyYardQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">Awaiting washing</span>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-blue-700">
                                <span className="text-[10px] uppercase font-bold">With Customers</span>
                                <UserCheck className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-lg font-black text-blue-700 tabular-nums">
                                {(item.customerQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">In customer custody</span>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-cyan-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-cyan-700">
                                <span className="text-[10px] uppercase font-bold">Washing</span>
                                <Factory className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-lg font-black text-cyan-700 tabular-nums">
                                {(item.washingQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">In cleaning cycle</span>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-sky-700">
                                <span className="text-[10px] uppercase font-bold">Filling</span>
                                <Droplets className="w-3.5 h-3.5 text-sky-600" />
                              </div>
                              <p className="text-lg font-black text-sky-700 tabular-nums">
                                {(item.fillingQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">At filling line</span>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-amber-700">
                                <span className="text-[10px] uppercase font-bold">Quarantine / QC</span>
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-lg font-black text-amber-700 tabular-nums">
                                {(item.quarantineQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">Under inspection</span>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between text-rose-700">
                                <span className="text-[10px] uppercase font-bold">Damaged</span>
                                <AlertCircle className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-lg font-black text-rose-700 tabular-nums">
                                {(item.damagedQuantity ?? 0).toLocaleString()}
                              </p>
                              <span className="block text-[10px] text-slate-400">Non-reusable jars</span>
                            </div>
                          </div>

                          {/* Image upload & toggle footer */}
                          <div className="px-4 py-2.5 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <input
                                ref={editFileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                aria-label="Change jar image"
                                disabled={isUpdatingImage}
                                onChange={(e) => {
                                  const selected = e.target.files?.[0];
                                  e.target.value = "";
                                  if (!selected) return;
                                  if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
                                    toast.error("Choose a JPEG, PNG, or WebP image.");
                                    return;
                                  }
                                  if (selected.size === 0 || selected.size > 5 * 1024 * 1024) {
                                    toast.error("Choose an image up to 5 MB.");
                                    return;
                                  }
                                  setActiveUploadItemId(item.id);
                                  setEditFile(selected);
                                }}
                              />
                              <button
                                className={button}
                                disabled={isUpdatingImage}
                                onClick={() => {
                                  setActiveUploadItemId(item.id);
                                  editFileInputRef.current?.click();
                                }}
                              >
                                <Upload className="h-3.5 w-3.5 text-slate-500" />
                                {item.imageUrl ? "Change Photo" : "Upload Photo"}
                              </button>
                              {activeUploadItemId === item.id && editFile && (
                                <button
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1264A8] rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                                  disabled={isUpdatingImage}
                                  onClick={() => void handleSaveItemImage(item.id)}
                                >
                                  {isUpdatingImage ? "Saving..." : "Save Image"}
                                </button>
                              )}
                              <span className="text-[11px] text-slate-400">
                                Invariant: ∑ Breakdown = {item.ownedQuantity} Owned · Variance: 0
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpanded(open ? null : item.id)}
                              className="inline-flex items-center gap-1 font-semibold text-[#1677C8] hover:underline cursor-pointer"
                            >
                              {open ? "Hide ledger transactions" : "View ledger transactions"}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>

                          {/* Expandable Transaction Ledger */}
                          {open && (
                            <div className="border-t border-[#E2E8F0]">
                              <InventoryTransactions
                                ownership="DISTRIBUTOR_OWNED"
                                jarItemId={item.id}
                                revision={revision}
                                stock={{
                                  total: item.ownedQuantity,
                                  available: item.availableQuantity,
                                  reserved: item.reservedQuantity,
                                  withCustomers: item.customerQuantity ?? null,
                                  damaged: item.damagedQuantity ?? null,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Informational Guidance */}
              <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-xl text-xs text-sky-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-700" />
                  Authoritative ERP Inventory Principles
                </p>
                <p className="text-[11px] text-sky-800 leading-relaxed">
                  1. Ownership is the master invariant. Jar movements across locations (washing, filling, customer possession) never change legal ownership quantities.<br />
                  2. Dispatches to customers move jars from Filled Yard to With Customer without reducing total owned stock.<br />
                  3. Customer empty jar returns move jars into Empty Yard and automatically credit the customer deposit ledger.
                </p>
              </div>
            </>
          )
        )}
      </div>

      {/* ─── MODAL 1: MOVE JARS (STATE TRANSITION) ────────────────────── */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 text-[#1677C8]">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    Move Physical Jars
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Record operational transitions between locations / stages
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMoveJarsSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jar Asset <span className="text-rose-500">*</span>
                </label>
                <select
                  value={moveJarItemId}
                  onChange={(e) => setMoveJarItemId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                >
                  {(data?.items || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.ownershipType === "COMPANY" ? "[Company]" : "[Distributor]"} {item.name} ({item.ownedQuantity} owned)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    From Location / State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={moveFromState}
                    onChange={(e) => setMoveFromState(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                  >
                    {PHYSICAL_STATES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Current: <strong>{getSelectedMoveItemCurrentStock()}</strong> jars
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    To Location / State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={moveToState}
                    onChange={(e) => setMoveToState(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                  >
                    {PHYSICAL_STATES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Target destination
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity to Move <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={getSelectedMoveItemCurrentStock() || undefined}
                  required
                  placeholder="e.g. 10"
                  value={moveQuantity}
                  onChange={(e) => setMoveQuantity(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Production Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Washing batch #42 completed, ready for filling"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                />
              </div>

              <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-[11px] text-sky-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  Physical movements are executed atomically in PostgreSQL and logged into the authoritative stock audit trail. Total owned jars will remain strictly preserved.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMoving || !moveQuantity}
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isMoving ? (
                    <>
                      <LoadingSpinner size="sm" light />
                      Moving Jars...
                    </>
                  ) : (
                    "Confirm Movement"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: QUICK CUSTOMER RETURN ───────────────────────────── */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    Record Customer Empty Return
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Receive empty jars back into distributor yard inventory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomerReturnSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jar Asset <span className="text-rose-500">*</span>
                </label>
                <select
                  value={returnJarItemId}
                  onChange={(e) => setReturnJarItemId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                >
                  {(data?.items || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.ownershipType === "COMPANY" ? "[Company]" : "[Distributor]"} {item.name} ({item.customerQuantity ?? 0} with customers)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Returned Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 5"
                    value={returnQuantity}
                    onChange={(e) => setReturnQuantity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Return Destination State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={returnState}
                    onChange={(e) => setReturnState(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                  >
                    <option value="EMPTY_YARD">Empty in Yard</option>
                    <option value="WASHING">Direct to Washing</option>
                    <option value="QUARANTINE">Quarantine / QC</option>
                    <option value="DAMAGED">Damaged on Return</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Receipt Reference Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Collected from Walk-in customer or route return"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 space-y-1">
                <span className="font-bold block">✓ No Stock Inflation</span>
                <span className="opacity-90 block">
                  Returned jars move from customer possession into the selected yard location. Total owned jars remain identical.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReturning || !returnQuantity}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isReturning ? (
                    <>
                      <LoadingSpinner size="sm" light />
                      Recording Return...
                    </>
                  ) : (
                    "Record Return"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADD DISTRIBUTOR JAR ITEM ─────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Register Distributor Jar
                </h3>
                <p className="text-[11px] text-slate-400">
                  Register a distributor-owned jar brand or variation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJarSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jar Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Cap 20L Jar"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jar Image <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={addFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                      toast.error("Choose a JPEG, PNG, or WebP image.");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Choose an image up to 5 MB.");
                      return;
                    }
                    setAddFile(file);
                  }}
                />

                <div
                  onClick={() => addFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                    addPreview
                      ? "border-[#1677C8] bg-sky-50/20"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  {addPreview ? (
                    <div className="flex items-center justify-center gap-3">
                      <img
                        src={addPreview}
                        alt="Preview"
                        className="h-14 w-14 object-contain rounded-lg border border-slate-200 bg-white"
                      />
                      <div className="text-left text-xs">
                        <span className="font-bold text-slate-800 block truncate max-w-[200px]">
                          {addFile?.name}
                        </span>
                        <span className="text-[11px] text-[#1677C8] font-semibold hover:underline">
                          Click to change image
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="h-6 w-6 text-slate-400 mx-auto" />
                      <div className="text-xs font-semibold text-slate-600">
                        Click to upload jar image
                      </div>
                      <div className="text-[10px] text-slate-400">
                        JPEG, PNG, WebP up to 5 MB
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Opening / Owned Quantity <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 40"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Initial stock count will be verified and recorded as an Opening Balance ledger movement.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Food-grade 20L jar with blue cap"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition"
                />
              </div>

              <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-xl text-[11px] text-sky-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  Creating a jar item records opening stock immediately into the inventory ledger.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !addName.trim() || !addFile}
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isCreating ? (
                    <>
                      <LoadingSpinner size="sm" light />
                      Creating...
                    </>
                  ) : (
                    "Create Jar Item"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
