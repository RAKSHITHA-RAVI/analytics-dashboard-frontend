export function groupSalesByMonth(rows: any[]) {
  const map = new Map<string, number>();

  rows.forEach((r) => {
    const d = new Date(r["Order Date"]);
    const s = Number(String(r["Sales"]).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(d.getTime()) || Number.isNaN(s)) return;

    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) || 0) + s);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, sales]) => ({ month, sales }));
}
