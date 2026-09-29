import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Boxes,
  Building2,
  ChevronDown,
  ImagePlus,
  Package,
  Plus,
  RefreshCw,
  Upload,
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
  isActive: boolean;
};

type Stock = {
  total: number;
  reserved?: number;
  available: number | null;
  withCustomers: number | null;
  damaged: number | null;
};

type InventoryData = {
  total: number;
  companyOwned: Stock;
  distributorOwned: Stock & { imageUrl: string | null };
  items?: JarInventoryItemRecord[];
};

export const inventoryQuantity = (value: number | null | undefined) =>
  value === null || value === undefined ? "Not tracked" : value.toLocaleString();

const button =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#1677C8]";

export default function Inventory() {
  const [data, setData] = useState<InventoryData | null>(null);
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
      const response: InventoryData = await fetchWithAuth(
        "/distributor/inventory",
      );
      if (id !== request.current) return;
      setData(response);
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

  // Extract items or fall back to company item
  const companyItem = data?.items?.find((i) => i.ownershipType === "COMPANY");
  const distributorItems = data?.items?.filter((i) => i.ownershipType === "DISTRIBUTOR") || [];

  const companyOwnedStock: Stock = {
    total: companyItem ? companyItem.ownedQuantity : data?.companyOwned.total || 0,
    reserved: companyItem ? companyItem.reservedQuantity : data?.companyOwned.reserved || 0,
    available: companyItem ? companyItem.availableQuantity : data?.companyOwned.available ?? null,
    withCustomers: data?.companyOwned.withCustomers ?? null,
    damaged: data?.companyOwned.damaged ?? null,
  };

  const distributorOwnedStockTotal = distributorItems.length > 0
    ? distributorItems.reduce((acc, i) => acc + i.ownedQuantity, 0)
    : data?.distributorOwned.total || 0;

  const distributorOwnedAvailableTotal = distributorItems.length > 0
    ? distributorItems.reduce((acc, i) => acc + i.availableQuantity, 0)
    : data?.distributorOwned.available ?? null;

  const availableKpi =
    companyOwnedStock.available !== null && distributorOwnedAvailableTotal !== null
      ? companyOwnedStock.available + distributorOwnedAvailableTotal
      : null;

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F8FAFC] animate-in fade-in duration-150">
      <DistributorTopbar
        title="Inventory"
        subtitle="Track jar ownership, order allocations, and stock movements."
        icon={Boxes}
        actions={
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
              onClick={handleOpenAddModal}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Jar Item
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
      <div className="w-full p-3.5 sm:p-6 space-y-4 flex-1">
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <span>{error}</span>
            <button className={button} onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {!data && loading ? (
          <LoadingSpinner label="Loading inventory..." />
        ) : (
          data && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {[
                  { label: "Total Jars", value: data.total, icon: Boxes },
                  {
                    label: "Company Owned",
                    value: companyOwnedStock.total,
                    icon: Building2,
                  },
                  {
                    label: "Distributor Owned",
                    value: distributorOwnedStockTotal,
                    icon: Package,
                  },
                  { label: "Available", value: availableKpi, icon: Boxes },
                ].map(({ label, value, icon: Icon }) => (
                  <ReportKpiCard
                    key={label}
                    label={label}
                    value={inventoryQuantity(value)}
                    icon={Icon}
                    colorVariant="blue"
                  />
                ))}
              </div>

              {/* ─── SECTION: COMPANY OWNED ───────────────────────────── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Company Owned
                  </h3>
                </div>

                <div className="w-full bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
                  <h2>
                    <button
                      type="button"
                      id="toggle-company-owned"
                      aria-expanded={expanded === "COMPANY_OWNED"}
                      aria-controls="panel-company-owned"
                      onClick={() => setExpanded(expanded === "COMPANY_OWNED" ? null : "COMPANY_OWNED")}
                      className="group flex w-full flex-wrap items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50/70 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#1677C8] sm:flex-nowrap sm:gap-4"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <img
                          src="/images/biodrops-jar.png"
                          alt="Biodrops 20L jar"
                          className="h-9 w-9 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-[#16324F]">
                          {companyItem?.name || "Biodrops 20L Water Jar"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 font-medium">
                          Biodrops / Company Owned
                        </span>
                      </span>

                      <div className="flex w-full gap-4 sm:gap-6 pl-[56px] sm:w-auto sm:pl-0">
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-slate-400">
                            Current Stock
                          </span>
                          <span className="text-xs font-black tabular-nums text-emerald-700">
                            {inventoryQuantity(companyOwnedStock.available ?? companyOwnedStock.total)} jars
                          </span>
                        </div>
                        {Boolean(companyOwnedStock.reserved && companyOwnedStock.reserved > 0) && (
                          <div>
                            <span className="block text-[10px] uppercase font-semibold text-slate-400">
                              Out for Delivery
                            </span>
                            <span className="text-xs font-bold tabular-nums text-amber-600">
                              {(companyOwnedStock.reserved ?? 0).toLocaleString()} jars
                            </span>
                          </div>
                        )}
                        {companyOwnedStock.total !== (companyOwnedStock.available ?? companyOwnedStock.total) && (
                          <div>
                            <span className="block text-[10px] uppercase font-semibold text-slate-400">
                              Owned Stock
                            </span>
                            <span className="text-xs font-bold tabular-nums text-[#16324F]">
                              {companyOwnedStock.total.toLocaleString()} jars
                            </span>
                          </div>
                        )}
                      </div>

                      <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold text-[#1677C8] group-hover:bg-[#1677C8]/10 transition-colors">
                        {expanded === "COMPANY_OWNED" ? "Hide transactions" : "View transactions"}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-150 ${expanded === "COMPANY_OWNED" ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                  </h2>

                  <div
                    id="panel-company-owned"
                    role="region"
                    aria-labelledby="toggle-company-owned"
                    inert={expanded !== "COMPANY_OWNED"}
                    className={`grid transition-[grid-template-rows] duration-150 motion-reduce:transition-none ${expanded === "COMPANY_OWNED" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      {expanded === "COMPANY_OWNED" && (
                        <InventoryTransactions
                          ownership="COMPANY_OWNED"
                          jarItemId={companyItem?.id}
                          revision={revision}
                          stock={companyOwnedStock}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── SECTION: DISTRIBUTOR OWNED ───────────────────────── */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Distributor Owned
                  </h3>
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1677C8] hover:text-[#1264A8] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Jar Item
                  </button>
                </div>

                {distributorItems.length === 0 ? (
                  <div className="p-6 bg-white border border-[#E2E8F0] rounded-xl text-center space-y-3 shadow-2xs">
                    <div className="flex justify-center">
                      <span className="p-3 bg-slate-50 border border-slate-200 rounded-full text-slate-400">
                        <Package className="h-6 w-6" />
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        No distributor-owned jar items yet.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Add your branded or distributor-owned jars to track separate stocks and allocations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#1264A8] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Jar Item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                          <h2>
                            <button
                              type="button"
                              id={`toggle-${item.id}`}
                              aria-expanded={open}
                              aria-controls={`panel-${item.id}`}
                              onClick={() => setExpanded(open ? null : item.id)}
                              className="group flex w-full flex-wrap items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50/70 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#1677C8] sm:flex-nowrap sm:gap-4"
                            >
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden">
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
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-bold text-[#16324F]">
                                  {item.name}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-slate-500 font-medium">
                                  {item.description || "Distributor Owned 20L Jar"}
                                </span>
                              </span>

                              <div className="flex w-full gap-4 sm:gap-6 pl-[56px] sm:w-auto sm:pl-0">
                                <div>
                                  <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                    Current Stock
                                  </span>
                                  <span className="text-xs font-black tabular-nums text-emerald-700">
                                    {item.availableQuantity.toLocaleString()} jars
                                  </span>
                                </div>
                                {Boolean(item.reservedQuantity && item.reservedQuantity > 0) && (
                                  <div>
                                    <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                      Out for Delivery
                                    </span>
                                    <span className="text-xs font-bold tabular-nums text-amber-600">
                                      {item.reservedQuantity.toLocaleString()} jars
                                    </span>
                                  </div>
                                )}
                                {item.ownedQuantity !== item.availableQuantity && (
                                  <div>
                                    <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                      Owned Stock
                                    </span>
                                    <span className="text-xs font-bold tabular-nums text-[#16324F]">
                                      {item.ownedQuantity.toLocaleString()} jars
                                    </span>
                                  </div>
                                )}
                              </div>

                              <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold text-[#1677C8] group-hover:bg-[#1677C8]/10 transition-colors">
                                {open ? "Hide transactions" : "View transactions"}
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                                />
                              </span>
                            </button>
                          </h2>

                          {open && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5">
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
                                <Upload className="h-3.5 w-3.5" />
                                {item.imageUrl ? "Change Image" : "Upload Image"}
                              </button>
                              {activeUploadItemId === item.id && editFile && (
                                <>
                                  <button
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1677C8] hover:bg-[#1264A8] rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                                    disabled={isUpdatingImage}
                                    onClick={() => void handleSaveItemImage(item.id)}
                                  >
                                    {isUpdatingImage ? "Saving..." : "Save Image"}
                                  </button>
                                  <button
                                    className={button}
                                    disabled={isUpdatingImage}
                                    onClick={() => {
                                      setEditFile(null);
                                      setActiveUploadItemId(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              <span className="text-[11px] text-slate-400">
                                {activeUploadItemId === item.id && editFile ? "Preview shown. Save to apply. " : ""}
                                JPEG, PNG, WebP · Up to 5 MB
                              </span>
                            </div>
                          )}

                          <div
                            id={`panel-${item.id}`}
                            role="region"
                            aria-labelledby={`toggle-${item.id}`}
                            inert={!open}
                            className={`grid transition-[grid-template-rows] duration-150 motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                          >
                            <div className="min-h-0 overflow-hidden">
                              {open && (
                                <InventoryTransactions
                                  ownership="DISTRIBUTOR_OWNED"
                                  jarItemId={item.id}
                                  revision={revision}
                                  stock={{
                                    total: item.ownedQuantity,
                                    withCustomers: null,
                                    damaged: null,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Owned stock records jar assets owned by company and distributor.
                Reserved represents stock currently dispatched on Out for Delivery orders.
                Available stock reflects available units in the warehouse hub.
              </p>
            </>
          )
        )}
      </div>

      {/* ─── MODAL: ADD DISTRIBUTOR JAR ───────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Add Distributor Jar
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
                  Creating a jar item records opening stock immediately into the inventory ledger. Available stock will reflect this opening quantity.
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
