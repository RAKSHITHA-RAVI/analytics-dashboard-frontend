type Props = {
  column: string;
  min: number;
  max: number;
  value: { min: number; max: number };
  onChange: (next: { min: number; max: number }) => void;
};

export default function NumericRangeFilter({
  column,
  min,
  max,
  value,
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

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="mb-1 text-gray-500 dark:text-slate-400">Min</div>
          <input
            type="number"
            value={Number.isFinite(value.min) ? value.min : min}
            min={min}
            max={max}
            onChange={(e) =>
              onChange({ min: Number(e.target.value), max: value.max })
            }
            className="
              w-full rounded-xl px-3 py-2 text-sm outline-none
              bg-white border border-gray-200 text-slate-900
              focus:ring-2 focus:ring-blue-600
              dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
            "
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-gray-500 dark:text-slate-400">Max</div>
          <input
            type="number"
            value={Number.isFinite(value.max) ? value.max : max}
            min={min}
            max={max}
            onChange={(e) =>
              onChange({ min: value.min, max: Number(e.target.value) })
            }
            className="
              w-full rounded-xl px-3 py-2 text-sm outline-none
              bg-white border border-gray-200 text-slate-900
              focus:ring-2 focus:ring-blue-600
              dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100
            "
          />
        </label>
      </div>

      <div className="text-xs text-gray-500 dark:text-slate-400 mt-3">
        Available range: {min} → {max}
      </div>

      <button
        className="
          text-sm underline mt-2
          text-gray-600 hover:text-gray-800
          dark:text-slate-300 dark:hover:text-slate-100
        "
        type="button"
        onClick={() => onChange({ min, max })}
      >
        Reset
      </button>
    </div>
  );
}
