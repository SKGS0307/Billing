import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/auth';

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await authApi.me()).data,
    retry: false,
    staleTime: 60_000,
  });
}
