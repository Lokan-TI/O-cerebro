import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource, ALL_SOURCES_ID } from "@/lib/ErpSourceContext";
import { mergeSnapshots } from "@/lib/mergeSnapshots";

export function useBrainSnapshot() {
  const { selectedSource, sources } = useErpSource();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAll = selectedSource?.id === ALL_SOURCES_ID;
  const sourceIds = sources.map((s) => s.id).join(",");

  useEffect(() => {
    let alive = true;
    if (!selectedSource?.id) { setLoading(false); return; }
    setLoading(true);

    const load = isAll
      ? Promise.all(
          sources.map((s) =>
            base44.entities.ErpSnapshot
              .filter({ source_id: s.id, is_current: true }, "-created_date", 1)
              .then((rows) => rows?.[0] || null)
              .catch(() => null)
          )
        ).then((rows) => mergeSnapshots(rows))
      : base44.entities.ErpSnapshot
          .filter({ source_id: selectedSource.id, is_current: true }, "-created_date", 1)
          .then((rows) => rows?.[0] || null);

    load
      .then((s) => { if (alive) setSnapshot(s); })
      .catch(() => { if (alive) setSnapshot(null); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [selectedSource?.id, isAll, sourceIds]);

  return { snapshot, loading, source: selectedSource };
}