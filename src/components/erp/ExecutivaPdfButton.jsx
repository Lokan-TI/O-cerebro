import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FileDown, Loader2 } from "lucide-react";

// Captura a Visão Executiva exatamente como renderizada e gera um PDF A4 paginado.
export default function ExecutivaPdfButton({ targetRef, fileLabel }) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const canvas = await html2canvas(targetRef.current, {
      backgroundColor: "#030712",
      scale: 2,
      useCORS: true,
      onclone: (doc) => {
        doc.querySelectorAll("[data-pdf-show]").forEach((el) => (el.style.display = "block"));
        doc.querySelectorAll("[data-pdf-hide]").forEach((el) => (el.style.display = "none"));
        doc.querySelectorAll('[class*="max-h-"]').forEach((el) => {
          el.style.maxHeight = "none";
          el.style.overflow = "visible";
        });
      },
    });
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const imgW = pageW - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const sliceH = Math.floor((pageH - margin * 2) * pxPerMm);
    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const h = Math.min(sliceH, canvas.height - y);
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height = h;
      const ctx = part.getContext("2d");
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, part.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.setFillColor(3, 7, 18);
      pdf.rect(0, 0, pageW, pageH, "F");
      pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, h / pxPerMm);
    }
    const safe = String(fileLabel).replace(/[^\w\-]+/g, "_");
    pdf.save(`visao_executiva_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`);
    setBusy(false);
  };

  return (
    <button
      data-pdf-hide
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-purple-700/50 bg-purple-950/40 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-900/50 disabled:opacity-60 transition-colors"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
      {busy ? "Gerando PDF…" : "Baixar PDF"}
    </button>
  );
}