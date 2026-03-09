import TabFunilConversao from "@/components/google/TabFunilConversao";

export default function FunilConversao() {
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Funil de Conversão</h1>
          <p className="text-gray-500 text-sm mt-1">Google First-Touch · Análise por vendedor e categoria</p>
        </div>
        <TabFunilConversao />
      </div>
    </div>
  );
}