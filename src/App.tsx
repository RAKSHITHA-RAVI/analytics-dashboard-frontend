// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

import UploadCSV from "./components/UploadCSV";
import DataTable from "./components/DataTable";
import CategoryFilter from "./components/Filters/CategoryFilter";
import DateRangeFilter from "./components/Filters/DateRangeFilter";
import NumericRangeFilter from "./components/Filters/NumericRangeFilter";

import SalesOverTime from "./components/charts/SalesOverTime";
import { groupSalesByMonth } from "./utils/groupByMonth";
import { inferColumnTypes } from "./utils/inferColumnTypes";

/* ----------------------------- Types + Helpers ----------------------------- */

type Filter =
  | { type: "category"; values: string[]; selected: string[] }
  | { type: "date"; min: string; max: string; start: string; end: string }
  | {
      type: "number";
      min: number;
      max: number;
      activeMin: number;
      activeMax: number;
    }
  | { type: "text"; query: string };

const toNum = (v: any) => {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/[^0-9.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

const toYMD = (t: number) => new Date(t).toISOString().slice(0, 10);

const ACTIVE_FILTERS_KEY = "f";
const QUERY_KEY = "q";

const getParam = (k: string) =>
  new URLSearchParams(window.location.search).get(k);

const setParams = (params: Record<string, string | null>) => {
  const sp = new URLSearchParams(window.location.search);
  Object.entries(params).forEach(([k, v]) => {
    if (!v) sp.delete(k);
    else sp.set(k, v);
  });
  const qs = sp.toString();
  const newUrl = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
};

type ActiveFiltersPayload = {
  [col: string]:
    | { type: "category"; selected: string[] }
    | { type: "date"; start: string; end: string }
    | { type: "number"; activeMin: number; activeMax: number }
    | { type: "text"; query: string };
};

const encodeActiveFilters = (payload: ActiveFiltersPayload) =>
  JSON.stringify(payload);

const decodeActiveFilters = (raw: string | null): ActiveFiltersPayload | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/* -------------------------- localStorage persistence -------------------------- */

const LS_ROWS_KEY = "csv_dashboard_rows_v1";

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/* ------------------------------ Main Component ----------------------------- */

export default function App() {
  /* ------------------------------ Theme (Dark) ------------------------------ */
  const [dark, setDark] = useState<boolean>(() => {
    const s = localStorage.getItem("ui_theme");
    if (s === "dark") return true;
    if (s === "light") return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  useEffect(() => {
    localStorage.setItem("ui_theme", dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  /* ------------------------------ Dataset ------------------------------ */
  const [rows, setRows] = useState<any[]>(() => {
    const saved = safeJsonParse<any[]>(localStorage.getItem(LS_ROWS_KEY));
    return Array.isArray(saved) ? saved : [];
  });

  const [filters, setFilters] = useState<Record<string, Filter>>({});
  const [globalQuery, setGlobalQuery] = useState(() => getParam(QUERY_KEY) || "");
  const [shareMsg, setShareMsg] = useState("");

  // table controls (passed to DataTable if your DataTable supports them)
  const [wrapCells, setWrapCells] = useState(true);
  const [freezeFirst, setFreezeFirst] = useState(true);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);

  const [filtersCollapsed, setFiltersCollapsed] = useState({
    categories: false,
    dates: false,
    numbers: false,
    text: false,
  });

  useEffect(() => {
    if (!rows || rows.length === 0) {
      localStorage.removeItem(LS_ROWS_KEY);
      return;
    }
    try {
      localStorage.setItem(LS_ROWS_KEY, JSON.stringify(rows));
    } catch {
      // ignore storage failure (huge dataset)
    }
  }, [rows]);

  const activeFromUrl = useMemo(
    () => decodeActiveFilters(getParam(ACTIVE_FILTERS_KEY)),
    []
  );

  /* ------------------------- Build dynamic filters on load ------------------------- */
  useEffect(() => {
    if (!rows || rows.length === 0) {
      setFilters({});
      return;
    }

    const types = inferColumnTypes(rows);
    const next: Record<string, Filter> = {};

    for (const [col, t] of Object.entries(types)) {
      if (t === "category") {
        const vals = Array.from(new Set(rows.map((r) => r[col]).filter(Boolean)))
          .map(String)
          .sort((a, b) => a.localeCompare(b));
        next[col] = { type: "category", values: vals, selected: [] };
      } else if (t === "date") {
        const times = rows
          .map((r) => new Date(r[col]).getTime())
          .filter((x) => !Number.isNaN(x));

        if (!times.length) {
          next[col] = { type: "date", min: "", max: "", start: "", end: "" };
        } else {
          next[col] = {
            type: "date",
            min: toYMD(Math.min(...times)),
            max: toYMD(Math.max(...times)),
            start: "",
            end: "",
          };
        }
      } else if (t === "number") {
        const nums = rows
          .map((r) => toNum(r[col]))
          .filter(Number.isFinite) as number[];

        if (!nums.length) {
          next[col] = { type: "number", min: 0, max: 0, activeMin: 0, activeMax: 0 };
        } else {
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          next[col] = { type: "number", min, max, activeMin: min, activeMax: max };
        }
      } else {
        next[col] = { type: "text", query: "" };
      }
    }

    // Apply active URL filters onto this dataset (only where column exists + types match)
    if (activeFromUrl) {
      for (const [col, a] of Object.entries(activeFromUrl)) {
        const f = next[col];
        if (!f) continue;

        if (f.type === "category" && a.type === "category") {
          next[col] = {
            ...f,
            selected: (a.selected || []).filter((x) => f.values.includes(x)),
          };
        }
        if (f.type === "date" && a.type === "date") {
          next[col] = { ...f, start: a.start || "", end: a.end || "" };
        }
        if (f.type === "number" && a.type === "number") {
          next[col] = {
            ...f,
            activeMin: Number.isFinite(a.activeMin) ? a.activeMin : f.min,
            activeMax: Number.isFinite(a.activeMax) ? a.activeMax : f.max,
          };
        }
        if (f.type === "text" && a.type === "text") {
          next[col] = { ...f, query: a.query || "" };
        }
      }
    }

    setFilters(next);
  }, [rows]);

  const updateFilter = (col: string, patch: Partial<Filter>) => {
    setFilters((prev) => {
      const cur = prev[col];
      if (!cur) return prev;
      return { ...prev, [col]: { ...cur, ...(patch as any) } };
    });
  };

  /* ------------------------------ Filtering logic ------------------------------ */
  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    return rows.filter((r) => {
      for (const [col, f] of Object.entries(filters)) {
        const raw = r[col];

        if (f.type === "category") {
          if (f.selected.length > 0 && !f.selected.includes(String(raw))) return false;
        }

        if (f.type === "date") {
          if (f.start || f.end) {
            const t = new Date(raw).getTime();
            if (Number.isNaN(t)) return false;
            const startT = f.start ? new Date(f.start).getTime() : null;
            const endT = f.end ? new Date(f.end + "T23:59:59").getTime() : null;
            if (startT && t < startT) return false;
            if (endT && t > endT) return false;
          }
        }

        if (f.type === "number") {
          const n = toNum(raw);
          if (!Number.isFinite(n)) return false;
          if (n < f.activeMin) return false;
          if (n > f.activeMax) return false;
        }

        if (f.type === "text") {
          if (f.query.trim()) {
            const q = f.query.toLowerCase();
            if (!String(raw ?? "").toLowerCase().includes(q)) return false;
          }
        }
      }

      if (globalQuery.trim()) {
        const q = globalQuery.toLowerCase();
        const any = Object.values(r).some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        );
        if (!any) return false;
      }

      return true;
    });
  }, [rows, filters, globalQuery]);

  /* ------------------------------ KPI Auto-pick ------------------------------ */
  const salesCol = useMemo(() => {
    const cols = Object.keys(filters);
    return (
      cols.find((c) => c.toLowerCase() === "sales") ||
      cols.find((c) => c.toLowerCase().includes("revenue")) ||
      cols.find((c) => c.toLowerCase().includes("sales")) ||
      null
    );
  }, [filters]);

  const profitCol = useMemo(() => {
    const cols = Object.keys(filters);
    return cols.find((c) => c.toLowerCase().includes("profit")) || null;
  }, [filters]);

  const dateCol = useMemo(() => {
    const cols = Object.keys(filters);
    return (
      cols.find((c) => c.toLowerCase().includes("order date")) ||
      cols.find((c) => c.toLowerCase().includes("date")) ||
      cols.find((c) => filters[c]?.type === "date") ||
      null
    );
  }, [filters]);

  const totalSales = useMemo(() => {
    if (!salesCol) return 0;
    return filteredRows.reduce((s, r) => s + (toNum(r[salesCol]) || 0), 0);
  }, [filteredRows, salesCol]);

  const totalProfit = useMemo(() => {
    if (!profitCol) return 0;
    return filteredRows.reduce((s, r) => s + (toNum(r[profitCol]) || 0), 0);
  }, [filteredRows, profitCol]);

  const salesOverTime = useMemo(() => {
    if (!dateCol || !salesCol) return [];
    const normalized = filteredRows.map((r) => ({
      "Order Date": r[dateCol],
      Sales: r[salesCol],
    }));
    return groupSalesByMonth(normalized);
  }, [filteredRows, dateCol, salesCol]);

  /* ----------------------- URL Sync for query + active filters ----------------------- */
  const activeFiltersPayload: ActiveFiltersPayload = useMemo(() => {
    const out: ActiveFiltersPayload = {};
    for (const [col, f] of Object.entries(filters)) {
      if (f.type === "category" && f.selected.length > 0)
        out[col] = { type: "category", selected: f.selected };
      if (f.type === "date" && (f.start || f.end))
        out[col] = { type: "date", start: f.start, end: f.end };
      if (f.type === "number" && (f.activeMin !== f.min || f.activeMax !== f.max))
        out[col] = { type: "number", activeMin: f.activeMin, activeMax: f.activeMax };
      if (f.type === "text" && f.query.trim())
        out[col] = { type: "text", query: f.query };
    }
    return out;
  }, [filters]);

  useEffect(() => {
    setParams({
      [QUERY_KEY]: globalQuery.trim() ? globalQuery : null,
      [ACTIVE_FILTERS_KEY]: Object.keys(activeFiltersPayload).length
        ? encodeActiveFilters(activeFiltersPayload)
        : null,
    });
  }, [globalQuery, activeFiltersPayload]);

  /* ------------------------------ Actions ------------------------------ */
  const resetAll = () => {
    setGlobalQuery("");
    setFilters((prev) => {
      const copy: Record<string, Filter> = {};
      for (const [col, f] of Object.entries(prev)) {
        if (f.type === "category") copy[col] = { ...f, selected: [] };
        else if (f.type === "date") copy[col] = { ...f, start: "", end: "" };
        else if (f.type === "number") copy[col] = { ...f, activeMin: f.min, activeMax: f.max };
        else copy[col] = { ...f, query: "" };
      }
      return copy;
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!");
    } catch {
      setShareMsg("Copy failed — copy from the URL bar.");
    }
    setTimeout(() => setShareMsg(""), 1500);
  };

  const clearSavedDataset = () => {
    localStorage.removeItem(LS_ROWS_KEY);
    setRows([]);
  };

  const loadDemo = async () => {
    try {
      const res = await fetch("/demo_superstore.csv");
      if (!res.ok)
        throw new Error("Demo file not found. Put it in public/demo_superstore.csv");
      const text = await res.text();

      const parsed = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      setRows((parsed.data as any[]).filter((r) => r && Object.keys(r).length > 0));
    } catch (e: any) {
      alert(e?.message || "Failed to load demo dataset");
    }
  };

  /* ------------------------------ UI Helpers ------------------------------ */
  const filterColumns = useMemo(() => Object.keys(filters), [filters]);

  const categoriesCols = filterColumns.filter((c) => filters[c]?.type === "category");
  const dateCols = filterColumns.filter((c) => filters[c]?.type === "date");
  const numberCols = filterColumns.filter((c) => filters[c]?.type === "number");
  const textCols = filterColumns.filter((c) => filters[c]?.type === "text");

  const activeFilterCount = useMemo(() => {
    let cnt = 0;
    for (const f of Object.values(filters)) {
      if (f.type === "category" && f.selected.length) cnt += f.selected.length;
      if (f.type === "date" && (f.start || f.end)) cnt += 1;
      if (f.type === "number" && (f.activeMin !== f.min || f.activeMax !== f.max)) cnt += 1;
      if (f.type === "text" && f.query.trim()) cnt += 1;
    }
    if (globalQuery.trim()) cnt += 1;
    return cnt;
  }, [filters, globalQuery]);

  const renderFilterForColumn = (col: string) => {
    const f = filters[col];
    if (!f) return null;

    if (f.type === "category") {
      return (
        <CategoryFilter
          key={col}
          column={col}
          values={f.values}
          selected={f.selected}
          onChange={(sel) => updateFilter(col, { selected: sel } as any)}
        />
      );
    }

    if (f.type === "date") {
      return (
        <DateRangeFilter
          key={col}
          column={col}
          min={f.min}
          max={f.max}
          start={f.start}
          end={f.end}
          onChange={(dr) => updateFilter(col, { start: dr.start, end: dr.end } as any)}
        />
      );
    }

    if (f.type === "number") {
      return (
        <NumericRangeFilter
          key={col}
          column={col}
          min={f.min}
          max={f.max}
          value={{ min: f.activeMin, max: f.activeMax }}
          onChange={(val) => updateFilter(col, { activeMin: val.min, activeMax: val.max } as any)}
        />
      );
    }

    return (
      <div
        key={col}
        className="
          space-y-2
          border rounded-2xl p-4
          bg-white border-gray-200
          dark:bg-slate-900 dark:border-slate-800
        "
      >
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {col}
        </div>
        <input
          value={f.query}
          onChange={(e) => updateFilter(col, { query: e.target.value } as any)}
          placeholder={`Filter ${col}...`}
          className="
            w-full rounded-xl border px-3 py-2 text-sm outline-none
            bg-white border-gray-200 text-slate-900
            focus:ring-2 focus:ring-blue-600
            dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
          "
        />
      </div>
    );
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];

    for (const [col, f] of Object.entries(filters)) {
      if (f.type === "category" && f.selected.length > 0) {
        for (const v of f.selected) {
          chips.push({
            key: `${col}|${v}`,
            label: `${col}: ${v}`,
            remove: () =>
              updateFilter(
                col,
                { selected: (f.selected || []).filter((x) => x !== v) } as any
              ),
          });
        }
      } else if (f.type === "date" && (f.start || f.end)) {
        chips.push({
          key: `${col}|date`,
          label: `${col}: ${f.start || "…"} → ${f.end || "…"}`,
          remove: () => updateFilter(col, { start: "", end: "" } as any),
        });
      } else if (
        f.type === "number" &&
        (f.activeMin !== f.min || f.activeMax !== f.max)
      ) {
        chips.push({
          key: `${col}|num`,
          label: `${col}: ${f.activeMin} → ${f.activeMax}`,
          remove: () =>
            updateFilter(col, { activeMin: f.min, activeMax: f.max } as any),
        });
      } else if (f.type === "text" && f.query.trim()) {
        chips.push({
          key: `${col}|text`,
          label: `${col}: ${f.query}`,
          remove: () => updateFilter(col, { query: "" } as any),
        });
      }
    }

    if (globalQuery.trim()) {
      chips.unshift({
        key: "__global__",
        label: `Search: ${globalQuery}`,
        remove: () => setGlobalQuery(""),
      });
    }

    return chips;
  }, [filters, globalQuery]);

  /* ------------------------------ Render ------------------------------ */
  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-b from-slate-50 to-gray-100 text-slate-900
        dark:bg-slate-950 dark:text-slate-100
      "
    >
      {/* Topbar */}
      <div className="border-b bg-white/80 backdrop-blur sticky top-0 z-30 dark:bg-slate-900/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              Analytics
            </div>
            <div className="hidden sm:block text-sm text-gray-500 dark:text-slate-400">
              Dynamic CSV Dashboard
            </div>
          </div>

          <div className="flex-1 max-w-lg">
            <input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Search across all columns..."
              className="
                w-full rounded-2xl border px-4 py-2 shadow-sm outline-none
                bg-white border-gray-200 text-slate-900
                focus:ring-2 focus:ring-blue-600
                dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
              "
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="px-4 py-2 rounded-2xl bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 active:scale-[0.99]"
            >
              Share
            </button>
            {shareMsg && (
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {shareMsg}
              </span>
            )}

            <label className="flex items-center gap-2 text-sm select-none text-gray-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={dark}
                onChange={(e) => setDark(e.target.checked)}
                className="h-4 w-4"
              />
              Dark
            </label>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center font-semibold shadow-sm">
              R
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {rows.length === 0 && (
          <div className="mb-6 rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-700 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
            <div className="font-semibold">No dataset loaded</div>
            <div className="mt-1 text-gray-500 dark:text-slate-400">
              Upload a CSV or click{" "}
              <span className="font-medium">Load Sample Superstore</span> to
              start exploring.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left */}
          <aside className="md:col-span-3">
            <div className="sticky top-24 space-y-4">
              {/* Upload / Demo */}
              <div className="px-4 py-4 rounded-2xl shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800 space-y-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Upload / Demo
                </div>

                <UploadCSV onDataLoaded={setRows} />

                <div className="flex gap-2">
                  <button
                    onClick={loadDemo}
                    className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50
                               dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-100"
                  >
                    Load Sample Superstore
                  </button>
                  <button
                    onClick={clearSavedDataset}
                    className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50
                               dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-100"
                    title="Clear saved dataset"
                  >
                    Clear
                  </button>
                </div>

                {rows.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Saved locally — refresh will keep your data.
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="px-4 py-4 rounded-2xl shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Filters (auto)
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {activeFilterCount} active
                    </div>
                    <button
                      onClick={resetAll}
                      className="rounded-2xl border border-gray-200 bg-white px-3 py-1 text-xs font-medium shadow-sm hover:bg-gray-50
                                 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-100"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {filterColumns.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-slate-400">
                      Upload a CSV or load the demo to generate filters.
                    </div>
                  ) : (
                    <>
                      {/* Categories */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Categories
                          </div>
                          <button
                            onClick={() =>
                              setFiltersCollapsed((s) => ({
                                ...s,
                                categories: !s.categories,
                              }))
                            }
                            className="text-xs text-gray-500 dark:text-slate-400"
                          >
                            {filtersCollapsed.categories ? "Show" : "Hide"}
                          </button>
                        </div>
                        {!filtersCollapsed.categories &&
                          categoriesCols.map((col) => (
                            <div key={col} className="mb-2">
                              {renderFilterForColumn(col)}
                            </div>
                          ))}
                      </div>

                      {/* Dates */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Dates
                          </div>
                          <button
                            onClick={() =>
                              setFiltersCollapsed((s) => ({
                                ...s,
                                dates: !s.dates,
                              }))
                            }
                            className="text-xs text-gray-500 dark:text-slate-400"
                          >
                            {filtersCollapsed.dates ? "Show" : "Hide"}
                          </button>
                        </div>
                        {!filtersCollapsed.dates &&
                          dateCols.map((col) => (
                            <div key={col} className="mb-2">
                              {renderFilterForColumn(col)}
                            </div>
                          ))}
                      </div>

                      {/* Numbers */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Numbers
                          </div>
                          <button
                            onClick={() =>
                              setFiltersCollapsed((s) => ({
                                ...s,
                                numbers: !s.numbers,
                              }))
                            }
                            className="text-xs text-gray-500 dark:text-slate-400"
                          >
                            {filtersCollapsed.numbers ? "Show" : "Hide"}
                          </button>
                        </div>
                        {!filtersCollapsed.numbers &&
                          numberCols.map((col) => (
                            <div key={col} className="mb-2">
                              {renderFilterForColumn(col)}
                            </div>
                          ))}
                      </div>

                      {/* Text */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Text
                          </div>
                          <button
                            onClick={() =>
                              setFiltersCollapsed((s) => ({
                                ...s,
                                text: !s.text,
                              }))
                            }
                            className="text-xs text-gray-500 dark:text-slate-400"
                          >
                            {filtersCollapsed.text ? "Show" : "Hide"}
                          </button>
                        </div>
                        {!filtersCollapsed.text &&
                          textCols.map((col) => (
                            <div key={col} className="mb-2">
                              {renderFilterForColumn(col)}
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Quick stats + table controls */}
              <div className="px-4 py-4 rounded-2xl shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800">
                <div className="text-sm font-semibold mb-2 text-slate-900 dark:text-slate-100">
                  Quick stats
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Rows (filtered)
                  </div>
                  <div className="text-lg font-bold">{filteredRows.length}</div>

                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Total Sales
                  </div>
                  <div className="text-lg font-bold">
                    ${totalSales.toFixed(2)}
                  </div>

                  <div className="pt-2 text-xs text-gray-500 dark:text-slate-400">
                    Table controls
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={wrapCells}
                        onChange={(e) => setWrapCells(e.target.checked)}
                      />
                      Wrap
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={freezeFirst}
                        onChange={(e) => setFreezeFirst(e.target.checked)}
                      />
                      Freeze first col
                    </label>
                  </div>

                  <div className="pt-2">
                    <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                      Hide columns
                    </div>
                    <div className="flex flex-col gap-1 max-h-24 overflow-auto pr-1">
                      {Object.keys(filters).map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={hiddenCols.includes(c)}
                            onChange={() =>
                              setHiddenCols((prev) =>
                                prev.includes(c)
                                  ? prev.filter((x) => x !== c)
                                  : [...prev, c]
                              )
                            }
                          />
                          <span className="truncate">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right */}
          <section className="md:col-span-9 space-y-6">
            {/* Active chips */}
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <div
                  key={chip.key}
                  className="
                    flex items-center gap-2 px-3 py-1 rounded-full text-sm border
                    bg-white border-gray-200 text-slate-700
                    dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200
                  "
                >
                  <span className="max-w-xs truncate">{chip.label}</span>
                  <button
                    onClick={chip.remove}
                    className="text-xs text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5 shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800">
                <div className="text-sm text-gray-500 dark:text-slate-400">
                  Total Sales
                </div>
                <div className="text-3xl font-bold mt-2">
                  ${totalSales.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  {salesCol ? `Using: ${salesCol}` : "No sales-like column detected"}
                </div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800">
                <div className="text-sm text-gray-500 dark:text-slate-400">
                  Total Profit
                </div>
                <div className="text-3xl font-bold mt-2">
                  ${totalProfit.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  {profitCol ? `Using: ${profitCol}` : "No profit-like column detected"}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-4 shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800">
              {dateCol && salesCol ? (
                <SalesOverTime data={salesOverTime} />
              ) : (
                <div className="text-sm text-gray-500 dark:text-slate-400">
                  Chart needs one date column and one sales/revenue column. (Detected:{" "}
                  <span className="font-medium">{dateCol || "none"}</span>,{" "}
                  <span className="font-medium">{salesCol || "none"}</span>)
                </div>
              )}
            </div>

            {/* Table container (dark-ready wrapper) */}
            <div className="rounded-2xl p-4 shadow-sm border border-gray-200/70 bg-white dark:bg-slate-900 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  Data table
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500">
                  Rows shown: {Math.min(20, filteredRows.length)} of {filteredRows.length}
                </div>
              </div>

              {/* If your DataTable doesn't accept these props, remove them */}
              <DataTable
                rows={filteredRows}
                wrap={wrapCells as any}
                freezeFirst={freezeFirst as any}
                hiddenColumns={hiddenCols as any}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
