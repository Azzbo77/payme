/**
 * Hook for managing encrypted storage cache
 * Provides cache statistics and cleanup functions
 */

import { useCallback } from "react";
import {
  getCacheStats,
  clearCache,
  type LRUConfig,
} from "../utils/lruCache";

const DEFAULT_CONFIG: LRUConfig = {
  namespace: "encrypted_storage",
};

export function useCacheManagement() {
  const getStats = useCallback(
    (config: LRUConfig = DEFAULT_CONFIG) => {
      return getCacheStats(config);
    },
    []
  );

  const clear = useCallback((config: LRUConfig = DEFAULT_CONFIG) => {
    clearCache(config);
  }, []);

  return {
    getStats,
    clear,
  };
}
