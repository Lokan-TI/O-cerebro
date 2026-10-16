import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const empty = () => ({ searched: false, loading: false, rows: [], warnings: [], cursor: null, error: null });
export default function useCustomerSearch(sourceId, empresa) {
  const [term, setTerm] = useState('');
  const [state, setState] = useState(empty);
  const version = useRef(0), submitted = useRef('');
  useEffect(() => { version.current++; setState(empty()); submitted.current = ''; }, [sourceId, empresa]);
  useEffect(() => () => { version.current++; }, []);
  async function search(more = false) {
    const text = (more ? submitted.current : term).trim();
    if (text.length < 3) return;
    const request = ++version.current, cursor = more ? state.cursor : null;
    submitted.current = text;
    setState((s) => ({ ...(more ? s : empty()), searched: true, loading: true }));
    try {
      const { data } = await base44.functions.invoke('customerReactivation', { action: 'search', term: text, source_id: sourceId, cd_empresa: empresa, cursor });
      if (!data.success) throw new Error(data.error || 'Não foi possível pesquisar.');
      if (version.current === request) setState((s) => ({ searched: true, loading: false,
        rows: more ? [...s.rows, ...data.rows] : data.rows, warnings: [...new Set([...(more ? s.warnings : []), ...(data.warnings || [])])], cursor: data.next_cursor, error: null }));
    } catch (e) {
      if (version.current === request) setState((s) => ({ ...s, loading: false, error: e.response?.data?.error || e.message }));
    }
  }
  return { term, setTerm, state, search };
}