import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useRdCustomKpis(period) {
  const [running, setRunning] = useState(false), [progress, setProgress] = useState(null), [error, setError] = useState('');
  const stop = useRef(false), generation = useRef(0), busy = useRef(false);
  const scope = { start: period.start, endExclusive: period.endExclusive };
  const request = async (action) => {
    const { data } = await base44.functions.invoke('rdDealProducts', { ...scope, action });
    if (data.error) throw new Error(data.error);
    return data;
  };
  const query = useQuery({ queryKey: ['rd-custom-kpis', scope.start, scope.endExclusive], queryFn: () => request('custom_summary'), staleTime: 60000, refetchOnWindowFocus: false, retry: false });
  useEffect(() => {
    generation.current++; stop.current = true; setRunning(false); setProgress(null); setError('');
    return () => { generation.current++; stop.current = true; };
  }, [scope.start, scope.endExclusive]);
  const extract = async () => {
    if (busy.current) return;
    busy.current = true; stop.current = false; setRunning(true); setError('');
    const current = generation.current;
    try {
      do {
        const result = await request('custom_extract');
        if (current !== generation.current) break;
        setProgress(result);
        if (!result.remaining) break;
        if (!result.processed) throw new Error('Nenhuma negociação avançou. Retome a extração para tentar novamente.');
      } while (!stop.current);
    } catch (e) { if (current === generation.current) setError(e.response?.data?.error || e.message); }
    finally {
      busy.current = false;
      if (current === generation.current) { setRunning(false); await query.refetch(); }
    }
  };
  return { ...query, running, progress, extractionError: error, extract, pause: () => { stop.current = true; } };
}