import { useEffect, useMemo, useState } from "react";
import { inferColumnTypes } from "../utils/inferColumnTypes";

type Props = {
  rows: any[];
  wrap?: boolean;
  freezeFirst?: boolean;
  hiddenColumns?: any;
};
type SortDir = "asc" | "desc";

export default function DataTable({
  rows,
  wrap,
  freezeFirst,
  hiddenColumns,
}: Props) {
  // ✅ Guard: avoid crash when rows is empty
  if (!rows || rows.length === 0) {
    return (
      <div
        className="
          border rounded-2xl p-6 text-sm shadow-sm
          bg-white text-gray-500 border-gray-200
          dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800
        "
      >
        No data to display for the selected filters.
      </div>
    );
  }

  // Mark unused props as used to satisfy TypeScript's noUnusedLocals rule.
  // These props are accepted so the parent can pass them; this no-op avoids build errors.
  void wrap;
  void freezeFirst;
  void hiddenColumns;

  const types = inferColumnTypes(rows);
  const columns = Object.keys(rows[0]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting
  const [sortCol, setSortCol] = useState<string>(columns[0]);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // If dataset changes, keep sorting safe
  useEffect(() => {
    if (!columns.includes(sortCol)) {
      setSortCol(columns[0]);
      setSortDir("asc");
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.join("|")]);

  const toNum = (v: any) => {
    if (typeof v === "number") return v;
    if (v === null || v === undefined) return NaN;
    const s = String(v).replace(/[^0-9.-]/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const av = a?.[sortCol];
      const bv = b?.[sortCol];
      const t = types[sortCol];

      // number sort
      if (t === "number") {
        const an = toNum(av);
        const bn = toNum(bv);
        if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
        if (Number.isNaN(an)) return 1;
        if (Number.isNaN(bn)) return -1;
        return sortDir === "asc" ? an - bn : bn - an;
      }

      // date sort
      if (t === "date") {
        const ad = new Date(av).getTime();
        const bd = new Date(bv).getTime();
        if (Number.isNaN(ad) && Number.isNaN(bd)) return 0;
        if (Number.isNaN(ad)) return 1;
        if (Number.isNaN(bd)) return -1;
        return sortDir === "asc" ? ad - bd : bd - ad;
      }

      // text sort
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();
      if (as < bs) return sortDir === "asc" ? -1 : 1;
      if (as > bs) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }, [rows, sortCol, sortDir, types]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  // Keep page valid when filters/pageSize change
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const toggleSort = (col: string) => {
    setPage(1);
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (col !== sortCol) {
      return <span className="text-gray-300 dark:text-slate-600">↕</span>;
    }
    return sortDir === "asc" ? (
      <span className="text-gray-700 dark:text-slate-200">↑</span>
    ) : (
      <span className="text-gray-700 dark:text-slate-200">↓</span>
    );
  };

  return (
    <div
      className="
        border rounded-2xl shadow-sm overflow-auto
        bg-white border-gray-200
        dark:bg-slate-900 dark:border-slate-800
      "
    >
      {/* Header */}
      <div
        className="
          p-4 flex items-center justify-between gap-3
          border-b border-gray-100
          dark:border-slate-800
        "
      >
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            Data Table
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">
            Rows: {rows.length} • Sorted by{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {sortCol}
            </span>{" "}
            ({sortDir})
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Rows / page
          </label>
          <select
            className="
              border rounded-xl px-2 py-1 text-sm outline-none
              bg-white border-gray-200 text-slate-900
              focus:ring-2 focus:ring-blue-600
              dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
            "
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr
            className="
              bg-gray-50
              dark:bg-slate-800/70
            "
          >
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => toggleSort(col)}
                className="
                  px-3 py-2 text-left border-b whitespace-nowrap cursor-pointer select-none
                  border-gray-200
                  hover:bg-gray-100
                  dark:border-slate-700
                  dark:hover:bg-slate-800
                "
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {col}
                    </span>
                    <span className="text-[11px] font-normal text-gray-500 dark:text-slate-400">
                      {types[col]}
                    </span>
                  </div>
                  <SortIcon col={col} />
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {pageRows.map((row, i) => (
            <tr
              key={i}
              className="
                transition
                odd:bg-white even:bg-gray-50
                hover:bg-blue-50/40
                dark:odd:bg-slate-900 dark:even:bg-slate-900/60
                dark:hover:bg-slate-800/70
              "
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="
                    px-3 py-2 border-b align-top
                    border-gray-200 text-slate-900
                    dark:border-slate-800 dark:text-slate-100
                  "
                >
                  <div className="max-w-[320px] break-words">
                    {String(row[col] ?? "")}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div
        className="
          p-4 flex items-center justify-between
          border-t border-gray-100
          dark:border-slate-800
        "
      >
        <div className="text-xs text-gray-500 dark:text-slate-400">
          Page {page} of {totalPages}
        </div>

        <div className="flex items-center gap-2">
          {(["First", "Prev", "Next", "Last"] as const).map((label) => {
            const disabled =
              (label === "First" || label === "Prev") ? page === 1 : page === totalPages;

            const onClick = () => {
              if (label === "First") setPage(1);
              if (label === "Prev") setPage((p) => Math.max(1, p - 1));
              if (label === "Next") setPage((p) => Math.min(totalPages, p + 1));
              if (label === "Last") setPage(totalPages);
            };

            return (
              <button
                key={label}
                className="
                  px-3 py-1 rounded-xl border text-sm disabled:opacity-50
                  bg-white border-gray-200 text-slate-900 hover:bg-gray-50
                  dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700
                "
                onClick={onClick}
                disabled={disabled}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
