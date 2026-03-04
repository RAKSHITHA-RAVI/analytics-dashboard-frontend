export type ColumnType = "number" | "date" | "category" | "text";

const isDateLike = (v: any) => {
  if (v === null || v === undefined) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
};

export function inferColumnTypes(rows: any[]) {
  if (!rows.length) return {};

  const columns = Object.keys(rows[0]);
  const types: Record<string, ColumnType> = {};

  for (const col of columns) {
    const sample = rows
      .slice(0, 50)
      .map((r) => r[col])
      .filter((v) => v !== "" && v !== null);

    const allNumbers = sample.every((v) => typeof v === "number");
    const allDates = sample.every(isDateLike);
    const unique = new Set(sample.map(String));

    if (allNumbers) types[col] = "number";
    else if (allDates) types[col] = "date";
    else if (unique.size <= 20) types[col] = "category";
    else types[col] = "text";
  }

  return types;
}
