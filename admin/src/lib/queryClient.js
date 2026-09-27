import { QueryClient } from '@tanstack/react-query';

// One shared cache for the whole admin site. It is cleared whenever the
// signed-in account (or, for a superadmin, the school being viewed) changes,
// so one account's data is never shown to the next.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

export default queryClient;
