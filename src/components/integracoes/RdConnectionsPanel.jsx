import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import RdSetupWizard from "./wizard/RdSetupWizard";
import RdErpMatchCard from "./RdErpMatchCard";
import RdSyncHistory from "./RdSyncHistory";

export default function RdConnectionsPanel() {
  const [runs, setRuns] = useState([]);
  const load = () => base44.entities.RdSyncRun.list("-created_date", 30).then(setRuns);
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <RdSetupWizard />
      <div className="max-w-md"><RdErpMatchCard onChange={load} /></div>
      <RdSyncHistory runs={runs} />
    </div>
  );
}