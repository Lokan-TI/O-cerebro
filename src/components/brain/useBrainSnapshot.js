import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useErpSource } from "@/lib/ErpSourceContext";

export function useBrainSnapshot() {
  const { selectedSource } = useErpSource();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!selectedSource?.id) { setLoading(false); return; }
    setLoading(true);
    base44.entities.ErpSnapshot
      .filter({ source_id: selectedSource.id, is_current: true }, "-created_date", 1)
      .then((rows) => { if (alive) setSnapshot(rows?.[0] || null); })
      .catch(() => { if (alive) setSnapshot(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedSource?.id]);

  return { snapshot, loading, source: selectedSource };
}