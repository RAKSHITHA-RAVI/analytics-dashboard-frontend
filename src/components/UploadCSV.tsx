import { useRef, useState } from "react";
import Papa from "papaparse";

type Props = {
  onDataLoaded: (rows: any[]) => void;
};

export default function UploadCSV({ onDataLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    resetMessages();
    setLoading(true);

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      // helps with many real-world CSV exports
      transformHeader: (h) => (h ?? "").trim(),
      complete: (results) => {
        try {
          const data = (results.data as any[]) || [];

          // ✅ Parse-level errors from Papa
          const papaErrors = results.errors || [];
          if (papaErrors.length) {
            // show only first error to keep UI clean
            const first = papaErrors[0];
            setError(
              `CSV parse issue at row ${first.row ?? "?"}: ${first.message || "Unknown error"}`
            );
            onDataLoaded([]);
            return;
          }

          if (!data.length) {
            setError(
              "No rows found. Make sure the CSV has data (not just headers)."
            );
            onDataLoaded([]);
            return;
          }

          // Determine columns from first non-empty row
          const firstRow = data.find((r) => r && Object.keys(r).length > 0) || {};
          let cols = Object.keys(firstRow).map((c) => (c ?? "").trim());

          // Remove empty header keys
          cols = cols.filter((c) => c.length > 0);

          if (!cols.length) {
            setError(
              "CSV headers are missing or invalid. Ensure the first row contains column names."
            );
            onDataLoaded([]);
            return;
          }

          // Filter out totally empty rows
          const cleaned = data.filter((r) => {
            if (!r || typeof r !== "object") return false;
            return Object.keys(r).some((k) => {
              const v = r[k];
              return String(v ?? "").trim() !== "";
            });
          });

          if (!cleaned.length) {
            setError("CSV contained only empty rows.");
            onDataLoaded([]);
            return;
          }

          onDataLoaded(cleaned);

          setSuccess(
            `Loaded ${cleaned.length.toLocaleString()} rows and ${cols.length} columns.`
          );
        } catch (e: any) {
          setError(e?.message || "Failed to process CSV.");
          onDataLoaded([]);
        } finally {
          setLoading(false);
        }
      },

      error: (err) => {
        setLoading(false);
        setError(err?.message || "CSV parsing failed.");
        onDataLoaded([]);
      },
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={loading}
          onChange={(e) => {
            resetMessages();
            const file = e.target.files?.[0];
            if (!file) return;

            const isCsv =
              file.type === "text/csv" ||
              file.name.toLowerCase().endsWith(".csv");

            if (!isCsv) {
              setError("Please upload a .csv file.");
              clearInput();
              return;
            }

            handleFile(file);
          }}
          className={[
            "block w-full text-sm",
            "text-slate-700 dark:text-slate-200",
            "file:mr-3 file:rounded-xl file:border file:px-3 file:py-2 file:text-sm file:shadow-sm",
            "file:bg-white file:border-gray-200 hover:file:bg-gray-50",
            "dark:file:bg-slate-800 dark:file:border-slate-700 dark:hover:file:bg-slate-700",
            "dark:file:text-slate-200",
          ].join(" ")}
        />

        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Tip: Works best when the first row contains column headers.
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border px-3 py-2 text-sm shadow-sm bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900/40 dark:text-blue-200">
          Parsing CSV… please wait.
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border px-3 py-2 text-sm shadow-sm border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-semibold">Upload failed</div>
          <div className="mt-1">{error}</div>

          <button
            onClick={() => {
              resetMessages();
              clearInput();
            }}
            className="mt-2 rounded-xl border px-2 py-1 text-xs shadow-sm bg-white border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Success */}
      {!loading && success && (
        <div className="rounded-xl border px-3 py-2 text-sm shadow-sm border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
          <div className="font-semibold">Upload successful</div>
          <div className="mt-1">{success}</div>
        </div>
      )}
    </div>
  );
}
