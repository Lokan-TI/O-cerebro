import { useState, useRef } from "react";
import { X, Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, ChevronRight, Info } from "lucide-react";

// ── Cabeçalhos esperados na planilha ──────────────────────────
const COLUNAS = [
  { key: "cliente",       label: "cliente",        desc: "Nome da empresa / cliente",                  exemplo: "BRAZO ENGENHARIA" },
  { key: "resp",          label: "resp",            desc: "Responsável (vendedor)",                     exemplo: "LUIZ" },
  { key: "local",         label: "local",           desc: "Cidade e estado",                            exemplo: "LENÇÓIS PAULISTA" },
  { key: "produto",       label: "produto",         desc: "Produto do primeiro fechamento",             exemplo: "45 E" },
  { key: "valor_ft",      label: "valor_ft",        desc: "Valor do primeiro fechamento (R$)",          exemplo: "21546" },
  { key: "fechados_total",label: "fechados_total",  desc: "Total de negócios fechados (incluindo FT)",  exemplo: "3" },
  { key: "fechados_pos",  label: "fechados_pos",    desc: "Recompras (fechamentos após o 1º)",          exemplo: "2" },
  { key: "receita_total", label: "receita_total",   desc: "Receita total acumulada (R$)",               exemplo: "68000" },
  { key: "retido",        label: "retido",          desc: "Receita retida (recompras) (R$)",            exemplo: "46454" },
];

// ── Gera CSV do template ──────────────────────────────────────
function gerarTemplateCSV() {
  const header = COLUNAS.map(c => c.key).join(",");
  const exemplo = COLUNAS.map(c => c.exemplo).join(",");
  const instrucao = COLUNAS.map(c => `"[${c.desc}]"`).join(",");
  return `${header}\n${instrucao}\n${exemplo}`;
}

function downloadCSV(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Parser CSV simples ────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { error: "Arquivo vazio ou sem dados." };

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const missing = COLUNAS.map(c => c.key).filter(k => !headers.includes(k));
  if (missing.length > 0) return { error: `Colunas ausentes: ${missing.join(", ")}` };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Ignora linha de instrução (contém "[")
    if (line.includes("[")) continue;

    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ""; });

    const numFields = ["valor_ft", "fechados_total", "fechados_pos", "receita_total", "retido"];
    numFields.forEach(f => { obj[f] = parseFloat(obj[f]) || 0; });

    if (!obj.cliente) continue;
    rows.push(obj);
  }

  if (rows.length === 0) return { error: "Nenhuma linha de dados encontrada." };
  return { rows };
}

// ── Componente principal ──────────────────────────────────────
export default function ImportModal({ onClose, onImport }) {
  const [step, setStep] = useState("intro"); // intro | upload | preview | success
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      setParseResult(result);
      setStep("preview");
    };
    reader.readAsText(f, "utf-8");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleConfirm = () => {
    if (parseResult?.rows) {
      onImport(parseResult.rows);
      setStep("success");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">

        {/* Topbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-semibold">Importar Dados</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 px-6 pt-4">
          {["Instruções", "Upload", "Confirmar"].map((s, i) => {
            const stepIdx = { intro: 0, upload: 1, preview: 2, success: 2 }[step];
            const active = stepIdx >= i;
            return (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}>
                  {i + 1}
                </div>
                <span className={`text-xs ${active ? "text-gray-300" : "text-gray-600"}`}>{s}</span>
                {i < 2 && <ChevronRight className="w-3 h-3 text-gray-700 mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="p-6 space-y-5">

          {/* ─── STEP: intro ─── */}
          {step === "intro" && (
            <>
              <div className="bg-blue-950/40 border border-blue-800 rounded-xl p-4 text-sm text-blue-200 space-y-2">
                <p className="font-semibold text-blue-300">Como funciona?</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-200/80">
                  <li>Baixe o template CSV com as colunas já formatadas</li>
                  <li>Preencha os dados de cada cliente WON (uma linha por cliente)</li>
                  <li>Salve o arquivo e faça o upload aqui</li>
                  <li>Confirme a importação — os dados serão carregados no app</li>
                </ol>
              </div>

              {/* Tabela de colunas */}
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Colunas do template</p>
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="text-left text-gray-400 px-3 py-2">Coluna</th>
                        <th className="text-left text-gray-400 px-3 py-2">Descrição</th>
                        <th className="text-left text-gray-400 px-3 py-2">Exemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {COLUNAS.map(c => (
                        <tr key={c.key} className="hover:bg-gray-800/40">
                          <td className="px-3 py-1.5 text-blue-300 font-mono font-semibold">{c.key}</td>
                          <td className="px-3 py-1.5 text-gray-400">{c.desc}</td>
                          <td className="px-3 py-1.5 text-gray-500 font-mono">{c.exemplo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => downloadCSV(gerarTemplateCSV(), "template_clientes_won.csv")}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar Template CSV
                </button>
                <button
                  onClick={() => setStep("upload")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Já tenho o arquivo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ─── STEP: upload ─── */}
          {step === "upload" && (
            <>
              <div
                className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-10 text-center cursor-pointer transition-colors group"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-600 group-hover:text-blue-400 mx-auto mb-3 transition-colors" />
                <p className="text-gray-300 font-medium text-sm">Arraste o arquivo CSV aqui</p>
                <p className="text-gray-600 text-xs mt-1">ou clique para selecionar</p>
                <p className="text-gray-700 text-xs mt-3">Formato aceito: .csv (salvo como UTF-8)</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />

              <div className="flex items-start gap-2 bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-3">
                <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-yellow-300/80 text-xs">
                  Certifique-se de que o arquivo está no formato CSV com codificação UTF-8.
                  No Excel, use <em>"Salvar como → CSV UTF-8 (delimitado por vírgula)"</em>.
                </p>
              </div>

              <button onClick={() => setStep("intro")} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                ← Voltar às instruções
              </button>
            </>
          )}

          {/* ─── STEP: preview ─── */}
          {step === "preview" && (
            <>
              {parseResult?.error ? (
                <div className="flex items-start gap-3 bg-red-950/40 border border-red-700 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 font-semibold text-sm">Erro ao processar o arquivo</p>
                    <p className="text-red-400/80 text-xs mt-1">{parseResult.error}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 bg-green-950/30 border border-green-700 rounded-xl p-4">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    <div>
                      <p className="text-green-300 font-semibold text-sm">Arquivo válido</p>
                      <p className="text-green-400/70 text-xs mt-0.5">
                        {parseResult.rows.length} registros encontrados em <span className="font-mono">{file?.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Preview da tabela */}
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                      Prévia (primeiros {Math.min(5, parseResult.rows.length)} registros)
                    </p>
                    <div className="border border-gray-800 rounded-xl overflow-auto max-h-48">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-800 sticky top-0">
                          <tr>
                            {["cliente", "resp", "produto", "valor_ft", "receita_total", "retido"].map(h => (
                              <th key={h} className="text-left text-gray-400 px-3 py-2 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {parseResult.rows.slice(0, 5).map((r, i) => (
                            <tr key={i} className="hover:bg-gray-800/40">
                              <td className="px-3 py-1.5 text-white font-medium">{r.cliente}</td>
                              <td className="px-3 py-1.5 text-gray-400">{r.resp}</td>
                              <td className="px-3 py-1.5 text-gray-400">{r.produto}</td>
                              <td className="px-3 py-1.5 text-green-400">R$ {r.valor_ft?.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-1.5 text-blue-400">R$ {r.receita_total?.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-1.5 text-purple-400">R$ {r.retido?.toLocaleString("pt-BR")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setFile(null); setParseResult(null); }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Trocar arquivo
                </button>
                {!parseResult?.error && (
                  <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Importar {parseResult?.rows?.length} registros
                  </button>
                )}
              </div>
            </>
          )}

          {/* ─── STEP: success ─── */}
          {step === "success" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Importação concluída!</p>
                <p className="text-gray-400 text-sm mt-1">
                  {parseResult?.rows?.length} registros importados com sucesso.
                </p>
              </div>
              <p className="text-gray-600 text-xs">
                Os dados foram carregados no app. Atualize a página para visualizar as mudanças nos gráficos.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}