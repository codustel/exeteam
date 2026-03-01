'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  enabled?: boolean;
  threshold?: number;
  onLoadMore: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function useInfiniteScroll({
  enabled = true,
  threshold = 0.8,
  onLoadMore,
  hasNextPage = false,
  isFetchingNextPage = false,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        onLoadMore();
      }
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  );

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    const observer = new IntersectionObserver(handleIntersect, {
      threshold,
    });

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [enabled, threshold, handleIntersect]);

  const SentinelElement = () => (
    <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
  );

  return { sentinelRef, SentinelElement };
}
