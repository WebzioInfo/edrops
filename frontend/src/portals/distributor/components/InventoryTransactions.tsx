import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History, Search } from "lucide-react";
import { fetchWithAuth } from "../../../api/client";
import LoadingSpinner from "../../../components/LoadingSpinner";

type Transaction = {
  id: string;
  createdAt: string;
  eventTimestamp?: string | null;
  action: string;
  label: string;
  locationLabel?: string | null;
  quantity: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string | null;
  fromState?: string | null;
  toState?: string | null;
};
type Result = {
  items: Transaction[];
  page: number;
  limit: number;
  pages: number;
  total: number;
  incoming: number;
  outgoing: number;
  trackingSince: string | null;
  types: { value: string; label: string }[];
};
const field =
  "min-w-0 w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#16324F] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1677C8] transition";
const button =
  "px-2.5 py-1 border border-[#E2E8F0] rounded bg-white text-xs text-[#374151] hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const date = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
};

function formatStateLabel(st?: string | null) {
  if (!st) return "";
  return st.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Movement({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-slate-500">
        0 jars
      </span>
    );
  }
  const Icon = value < 0 ? ArrowUpRight : ArrowDownLeft;
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold tabular-nums ${value < 0 ? "text-rose-700" : "text-emerald-700"}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {value > 0 ? "+" : ""}
      {value.toLocaleString()} jars
    </span>
  );
}

export function InventoryTransactions({
  ownership,
  jarItemId,
  revision,
  stock,
}: {
  ownership: string;
  jarItemId?: string;
  revision: number;
  stock: {
    total: number;
    available?: number | null;
    filledYard?: number | null;
    emptyYard?: number | null;
    reserved?: number;
    withCustomers: number | null;
    damaged: number | null;
  };
}) {
  const [filters, setFilters] = useState({
    type: "",
    location: "",
    from: "",
    to: "",
    search: "",
    page: 1,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [types, setTypes] = useState<Result["types"]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(
      async () => {
        if (filters.from && filters.to && filters.from > filters.to) {
          setError("Start date must be on or before end date.");
          setLoading(false);
          return;
        }
        const params = new URLSearchParams({
          ownership,
          page: String(filters.page),
          limit: "20",
        });
        if (jarItemId) params.set("jarItemId", jarItemId);
        for (const key of ["type", "location", "from", "to", "search"] as const)
          if (filters[key]) params.set(key, filters[key]);
        try {
          const response: Result = await fetchWithAuth(
            `/distributor/inventory/transactions?${params}`,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          if (response.pages > 0 && filters.page > response.pages) {
            setFilters((current) => ({ ...current, page: response.pages }));
            return;
          }
          setResult(response);
          setTypes(response.types);
        } catch (err) {
          if (!controller.signal.aborted)
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load stock transactions.",
            );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      filters.search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ownership, jarItemId, filters, revision, retry]);
  const update = (key: "type" | "location" | "from" | "to" | "search", value: string) =>
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  const format = (value: number | null | undefined) =>
    value == null ? "Not tracked" : value.toLocaleString();
  return (
    <div className="border-t border-[#E2E8F0] bg-white">
      <div className="px-3.5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#16324F]">
          <History className="h-4 w-4 text-[#1677C8]" />
          Stock Transactions Ledger
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">
          Physical movement & reconciliation · Indian Standard Time (IST)
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-6 px-3.5 py-3 border-b border-[#E2E8F0]/60">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Available Filled Jars</p>
          <p className="mt-0.5 text-base font-black tabular-nums text-emerald-700">
            {format(stock.available ?? stock.filledYard ?? stock.total)} jars
          </p>
          <span className="text-[10px] text-slate-400">Available in yard for dispatch</span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Owned Jars</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-700">
            {format(stock.total)} jars
          </p>
          <span className="text-[10px] text-slate-400">Total owned asset volume</span>
        </div>
        {stock.emptyYard !== undefined && stock.emptyYard !== null && (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Empty Yard</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-700">
              {format(stock.emptyYard)} jars
            </p>
            <span className="text-[10px] text-slate-400">Returned / awaiting filling</span>
          </div>
        )}
        {stock.withCustomers !== undefined && stock.withCustomers !== null && (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Customer Holding</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-blue-700">
              {format(stock.withCustomers)} jars
            </p>
            <span className="text-[10px] text-slate-400">Physical custody with clients</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_1.5fr] bg-[#F8FAFC] border-y border-[#E2E8F0] px-3.5 py-2.5">
        <label className="text-[11px] text-slate-500 font-medium">
          Transaction type
          <select
            aria-label="Transaction type"
            className={`${field} mt-1`}
            value={filters.type}
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="">All Transactions</option>
            {types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-500 font-medium">
          Location / State
          <select
            aria-label="Location"
            className={`${field} mt-1`}
            value={filters.location}
            onChange={(e) => update("location", e.target.value)}
          >
            <option value="">All Locations</option>
            <option value="FILLED_YARD">Filled Yard</option>
            <option value="EMPTY_YARD">Empty Yard</option>
            <option value="CUSTOMER">Customer Holding</option>
            <option value="WASHING">Washing</option>
            <option value="FILLING">Filling</option>
            <option value="QUARANTINE">Quarantine</option>
            <option value="DAMAGED">Damaged</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-500 font-medium">
          From Date
          <input
            type="date"
            aria-label="From date"
            className={`${field} mt-1`}
            value={filters.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </label>
        <label className="text-[11px] text-slate-500 font-medium">
          To Date
          <input
            type="date"
            aria-label="To date"
            className={`${field} mt-1`}
            value={filters.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </label>
        <label className="text-[11px] text-slate-500 font-medium col-span-2 lg:col-span-1">
          Search
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="search"
              maxLength={120}
              className={`${field} pl-8 focus:bg-white`}
              placeholder="Reference or description"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </span>
        </label>
      </div>
      {(filters.type || filters.location || filters.from || filters.to || filters.search) && (
        <button
          className="mx-3.5 my-2 text-xs font-semibold text-[#1677C8] hover:underline cursor-pointer"
          onClick={() =>
            setFilters({ type: "", location: "", from: "", to: "", search: "", page: 1 })
          }
        >
          Clear filters
        </button>
      )}
      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <LoadingSpinner
            label="Loading stock transactions..."
            minHeight="min-h-[140px]"
          />
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700"
          >
            <p>{error}</p>
            <button
              className={`${button} mt-3`}
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : (
          result && (
            <>
              {result.items.length === 0 ? (
                <div className="py-10 px-4 bg-white text-center space-y-2">
                  <History className="mx-auto h-8 w-8 p-1.5 rounded-full bg-slate-100 text-slate-400" />
                  <p className="text-xs font-semibold text-[#16324F]">
                    {filters.type ||
                    filters.location ||
                    filters.from ||
                    filters.to ||
                    filters.search
                      ? "No matching stock transactions"
                      : "No stock transactions yet"}
                  </p>
                </div>
              ) : (
                <>
                  <table className="hidden md:table w-full table-fixed text-left text-xs text-[#16324F] border-collapse">
                    <caption className="sr-only">
                      {ownership === "COMPANY_OWNED"
                        ? "Edrops Owned"
                        : "Distributor-owned"}{" "}
                      jar inventory transactions
                    </caption>
                    <thead className="border-b border-[#E2E8F0] bg-slate-50/80 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                      <tr>
                        <th className="w-[22%] py-2.5 px-3.5">Date / Time (IST)</th>
                        <th className="w-[32%] py-2.5 px-3.5">Transaction</th>
                        <th className="w-[14%] py-2.5 px-3.5 text-right">
                          Quantity
                        </th>
                        <th className="w-[16%] py-2.5 px-3.5 text-right">
                          Available After
                        </th>
                        <th className="py-2.5 px-3.5">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {result.items.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2.5 px-3.5 text-slate-500 font-medium">
                            {date(item.eventTimestamp || item.createdAt)}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-[#16324F]">
                                {item.label}
                              </p>
                              {(item.fromState || item.toState) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                  {formatStateLabel(item.fromState)} → {formatStateLabel(item.toState)}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 break-words text-[11px] text-slate-500">
                              {item.description}
                            </p>
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <Movement value={item.quantity} />
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-semibold tabular-nums text-[#16324F]">
                            <div>
                              <span>{item.balanceAfter !== null && item.balanceAfter !== undefined ? `${item.balanceAfter.toLocaleString()} jars` : "—"}</span>
                              {item.locationLabel && (
                                <span className="block text-[10px] text-slate-400 font-medium">
                                  {item.locationLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="break-words py-2.5 px-3.5 text-slate-500">
                            {item.referenceId || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="md:hidden divide-y divide-[#E2E8F0]">
                    {result.items.map((item) => (
                      <article
                        key={item.id}
                        className="bg-white px-3.5 py-3 space-y-2 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex justify-between gap-3">
                          <time
                            className="text-[11px] text-slate-500 font-medium"
                            dateTime={item.eventTimestamp || item.createdAt}
                          >
                            {date(item.eventTimestamp || item.createdAt)}
                          </time>
                          <Movement value={item.quantity} />
                        </div>
                        <div className="mt-2 flex justify-between gap-3 text-xs">
                          <div>
                            <p className="font-semibold text-[#16324F]">
                              {item.label}
                            </p>
                            {(item.fromState || item.toState) && (
                              <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                {formatStateLabel(item.fromState)} → {formatStateLabel(item.toState)}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-right text-slate-500">
                            <span className="text-[11px] block">Available After</span>
                            <strong className="tabular-nums text-[#16324F]">
                              {item.balanceAfter !== null && item.balanceAfter !== undefined ? `${item.balanceAfter.toLocaleString()} jars` : "—"}
                            </strong>
                            {item.locationLabel && (
                              <span className="block text-[10px] text-slate-400">
                                ({item.locationLabel})
                              </span>
                            )}
                          </div>
                        </div>
                        {item.description && (
                          <p className="mt-1 text-[11px] text-slate-500 break-words">
                            {item.description}
                          </p>
                        )}
                        {item.referenceId && (
                          <p className="mt-1 break-words text-[11px] text-slate-400 font-mono">
                            {item.referenceId}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-t border-[#F1F5F9] text-xs text-[#64748B]">
                <span>
                  Showing{" "}
                  {result.total === 0
                    ? 0
                    : (result.page - 1) * result.limit + 1}
                  –{Math.min(result.page * result.limit, result.total)} of{" "}
                  {result.total.toLocaleString()} transactions
                </span>
                <nav
                  aria-label="Transaction pages"
                  className="flex items-center gap-2"
                >
                  <button
                    className={button}
                    disabled={result.page <= 1}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        page: current.page - 1,
                      }))
                    }
                  >
                    Previous
                  </button>
                  <span>
                    Page {result.page} of {Math.max(1, result.pages)}
                  </span>
                  <button
                    className={button}
                    disabled={result.page >= result.pages}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        page: current.page + 1,
                      }))
                    }
                  >
                    Next
                  </button>
                </nav>
              </div>
              {result.trackingSince && (
                <p className="px-3.5 pb-3 text-[10px] text-slate-400 leading-relaxed">
                  History starts {date(result.trackingSince)} UTC.
                  Incoming/outgoing exclude opening balances. Balances remain
                  the recorded post-transaction totals when filters are applied.
                </p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
