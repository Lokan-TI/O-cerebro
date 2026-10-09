import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FileDown, Loader2 } from "lucide-react";

// Captura a Visão Executiva exatamente como renderizada e gera um PDF A4 paginado.
export default function ExecutivaPdfButton({ targetRef, fileLabel }) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    let atoms = [];
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
        // Mede, no layout final do clone, os blocos que não podem ser cortados.
        const root = doc.querySelector("[data-pdf-root]");
        const top0 = root.getBoundingClientRect().top;
        atoms = [...root.querySelectorAll("tr, svg, h3, p, .rounded-xl, .rounded-lg")]
          .map((el) => { const r = el.getBoundingClientRect(); return [r.top - top0, r.bottom - top0]; })
          .filter(([t, b]) => b > t);
      },
    });
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const imgW = pageW - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const sliceH = Math.floor((pageH - margin * 2) * pxPerMm);
    const s = canvas.width / targetRef.current.offsetWidth; // px DOM -> px canvas
    const fits = atoms.filter(([t, b]) => (b - t) * s < sliceH);
    const pickBreak = (y) => {
      const max = y + sliceH;
      if (max >= canvas.height) return canvas.height;
      const cands = fits.flatMap(([t, b]) => [t * s - 4, b * s + 4])
        .filter((c) => c > y + sliceH * 0.3 && c <= max)
        .filter((c) => !fits.some(([t, b]) => t * s < c && b * s > c))
        .sort((a, b) => b - a);
      return Math.floor(cands[0] ?? max);
    };
    for (let y = 0, page = 0; y < canvas.height; page++) {
      const end = pickBreak(y);
      const h = end - y;
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
      y = end;
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