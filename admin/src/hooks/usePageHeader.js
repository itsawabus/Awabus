import { useEffect } from 'react';
import { useTopbarStore } from '../store/topbarStore.js';

// Declares this page's breadcrumb + (optional) live search box on the shared Topbar.
export function usePageHeader({ breadcrumb, searchPlaceholder, searchValue, onSearchChange }) {
  const setTopbar = useTopbarStore((s) => s.setTopbar);

  useEffect(() => {
    setTopbar({
      breadcrumb,
      searchPlaceholder: searchPlaceholder ?? 'Search routes, buses, students...',
      searchValue: searchValue ?? '',
      onSearchChange: onSearchChange ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(breadcrumb), searchPlaceholder, searchValue]);
}

export default usePageHeader;
