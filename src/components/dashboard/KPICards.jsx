export default function KPICards({ data }) {
  const total = data.length;
  const vendedores = new Set(data.map((l) => l.vendedor).filter(Boolean)).size;
  const produtos = new Set(data.map((l) => l.produto).filter(Boolean)).size;

  const produtoCount = {};
  data.forEach((l) => {
    if (l.produto) produtoCount[l.produto] = (produtoCount[l.produto] || 0) + 1;
  });
  const topProduto = Object.entries(produtoCount).sort((a, b) => b[1] - a[1])[0];

  const vendedorCount = {};
  data.forEach((l) => {
    if (l.vendedor) vendedorCount[l.vendedor] = (vendedorCount[l.vendedor] || 0) + 1;
  });
  const topVendedor = Object.entries(vendedorCount).sort((a, b) => b[1] - a[1])[0];

  const cards = [
    { label: "Total de Leads Perdidos", value: total, sub: "oportunidades não convertidas", color: "border-red-600" },
    { label: "Vendedores Ativos", value: vendedores, sub: "com leads registrados", color: "border-gray-500" },
    { label: "Produtos Distintos", value: produtos, sub: "tipos cotados", color: "border-gray-500" },
    { label: "Top Produto", value: topProduto?.[0] ?? "-", sub: `${topProduto?.[1] ?? 0} ocorrências`, color: "border-red-800", small: true },
    { label: "Top Vendedor", value: topVendedor?.[0] ?? "-", sub: `${topVendedor?.[1] ?? 0} leads`, color: "border-red-800", small: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`bg-gray-900 border-l-4 ${c.color} rounded-lg p-4`}>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{c.label}</p>
          <p className={`font-bold text-white ${c.small ? "text-lg leading-tight" : "text-3xl"}`}>{c.value}</p>
          <p className="text-gray-500 text-xs mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}