import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  data: { month: string; sales: number }[];
};

export default function SalesOverTime({ data }: Props) {
  return (
    <div className="border rounded-xl bg-white shadow-sm p-4">
      <div className="font-semibold mb-2">Sales Over Time</div>

      {/* ✅ Explicit height fixes recharts warning */}
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="sales"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
