type Props = {
  column: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function CategoryFilter({
  column,
  values,
  selected,
  onChange,
}: Props) {
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };

  const clearAll = () => onChange([]);

  return (
    <div
      className="
        border rounded-2xl p-4
        bg-white border-gray-200
        dark:bg-slate-900 dark:border-slate-800
      "
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
          {column}
        </div>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="
              text-xs underline
              text-gray-600 hover:text-gray-800
              dark:text-slate-300 dark:hover:text-slate-100
              whitespace-nowrap
            "
          >
            Clear
          </button>
        )}
      </div>

      <div
        className="
          max-h-44 overflow-auto space-y-1 pr-1
          rounded-xl border
          border-gray-100 bg-gray-50
          dark:border-slate-800 dark:bg-slate-950
        "
      >
        {values.length === 0 ? (
          <div className="p-3 text-sm text-gray-500 dark:text-slate-400">
            No values available.
          </div>
        ) : (
          values.map((v) => (
            <label
              key={v}
              className="
                flex items-center gap-2 text-sm
                px-3 py-2 cursor-pointer select-none
                hover:bg-white
                dark:hover:bg-slate-900
                text-slate-700 dark:text-slate-200
              "
            >
              <input
                type="checkbox"
                checked={selected.includes(v)}
                onChange={() => toggle(v)}
                className="
                  h-4 w-4 rounded
                  border-gray-300
                  text-blue-600 focus:ring-blue-600
                  dark:border-slate-700 dark:bg-slate-900
                "
              />
              <span className="truncate">{v}</span>
            </label>
          ))
        )}
      </div>

      {values.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          {selected.length} selected
        </div>
      )}
    </div>
  );
}
