type Props = {
  column: string;
  min?: string; // yyyy-mm-dd
  max?: string; // yyyy-mm-dd
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
};

export default function DateRangeFilter({
  column,
  min,
  max,
  start,
  end,
  onChange,
}: Props) {
  return (
    <div
      className="
        border rounded-2xl p-4
        bg-white border-gray-200
        dark:bg-slate-900 dark:border-slate-800
      "
    >
      <div className="font-medium mb-2 text-slate-900 dark:text-slate-100">
        {column}
      </div>

      <div className="space-y-3">
        <label className="block text-sm">
          <div className="mb-1 text-gray-500 dark:text-slate-400">Start</div>
          <input
            type="date"
            value={start}
            min={min}
            max={max}
            onChange={(e) => onChange({ start: e.target.value, end })}
            className="
              w-full rounded-xl px-3 py-2 text-sm outline-none
              bg-white border border-gray-200 text-slate-900
              focus:ring-2 focus:ring-blue-600
              dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
            "
          />
        </label>

        <label className="block text-sm">
          <div className="mb-1 text-gray-500 dark:text-slate-400">End</div>
          <input
            type="date"
            value={end}
            min={min}
            max={max}
            onChange={(e) => onChange({ start, end: e.target.value })}
            className="
              w-full rounded-xl px-3 py-2 text-sm outline-none
              bg-white border border-gray-200 text-slate-900
              focus:ring-2 focus:ring-blue-600
              dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
            "
          />
        </label>

        {(start || end) && (
          <button
            className="
              text-sm underline
              text-gray-600 hover:text-gray-800
              dark:text-slate-300 dark:hover:text-slate-100
            "
            onClick={() => onChange({ start: "", end: "" })}
            type="button"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
