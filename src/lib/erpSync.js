import { base44 } from "@/api/base44Client";

export async function pollRun(runId, onUpdate, intervalMs = 3000) {
  return new Promise((resolve) => {
    const tick = async () => {
      try {
        const run = await base44.entities.ErpSyncRun.get(runId);
        if (onUpdate) onUpdate(run);
        if (run.status === "running" || run.status === "pending") {
          setTimeout(tick, intervalMs);
        } else {
          resolve(run);
        }
      } catch (e) {
        resolve({ status: "failed", error: e.message });
      }
    };
    tick();
  });
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}min ${rs}s`;
}

export function formatDateTime(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return String(dt); }
}

export function daysSince(dt) {
  if (!dt) return null;
  try {
    return Math.floor((Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}