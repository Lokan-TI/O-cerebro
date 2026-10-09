import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from "recharts";

import { Cell } from "recharts";

export default function RfmDistChart({ title, prefix, values, color, selected, onSelect }) {
  const data = values.map((v, i) => ({ name: `${prefix}${i + 1}`, v }));
  return (
    <div>
      <p className="text-xs font-semibold text-gray-300 text-center mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} cursor="pointer" onClick={(_, i) => onSelect(i + 1)}>
            {data.map((d, i) => <Cell key={d.name} fillOpacity={selected == null || selected === i + 1 ? 1 : 0.35} />)}
            <LabelList dataKey="v" position="top" fill="#d1d5db" fontSize={10} formatter={(v) => v.toLocaleString("pt-BR")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}