/**
 * SDLC Snapshot Cache
 * Simple in-memory cache with TTL
 */

import type { SDLCSnapshot } from '../types';

interface CacheEntry {
  data: SDLCSnapshot;
  timestamp: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds
let cache: CacheEntry | null = null;

/**
 * Get cached snapshot if still valid
 */
export function getCachedSnapshot(): SDLCSnapshot | null {
  if (!cache) {
    return null;
  }

  const age = Date.now() - cache.timestamp;
  if (age > CACHE_TTL_MS) {
    cache = null;
    return null;
  }

  return cache.data;
}

/**
 * Set cached snapshot
 */
export function setCachedSnapshot(data: SDLCSnapshot): void {
  cache = {
    data,
    timestamp: Date.now(),
  };
}

/**
 * Clear cache
 */
export function clearCache(): void {
  cache = null;
}
