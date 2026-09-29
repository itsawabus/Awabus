import { useQuery } from '@tanstack/react-query';
import { getTripPhotos } from '../api/driverApp.js';

/**
 * Students' photos for a trip, { studentId: photo }. Photos are large, so
 * they are fetched once per trip and kept, never with the frequent trip refresh.
 */
export function useTripPhotos(tripId) {
  const { data } = useQuery({
    queryKey: ['trip-photos', tripId],
    queryFn: () => getTripPhotos(tripId),
    enabled: Boolean(tripId),
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });
  return data || {};
}

export default useTripPhotos;
