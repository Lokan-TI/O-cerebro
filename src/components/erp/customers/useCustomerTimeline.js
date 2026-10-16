import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useCustomerTimeline(profile, category) {
  const { scope, person, coverage } = profile;
  return useInfiniteQuery({
    queryKey: ['customer-timeline', scope.source_id, scope.cd_empresa, person.cd_pessoa, category, coverage.proposals.available],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const { data } = await base44.functions.invoke('customerReactivation', { action: 'timeline', category,
        source_id: scope.source_id, cd_empresa: scope.cd_empresa, client_id: String(person.cd_pessoa),
        include_proposals: coverage.proposals.available, cursor: pageParam });
      if (!data.success) throw new Error(data.error || 'Não foi possível consultar o histórico.');
      return data;
    },
    getNextPageParam: (page) => page.next_cursor || undefined,
    staleTime: 60000,
    retry: false,
  });
}