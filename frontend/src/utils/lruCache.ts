/**
 * LRU (Least Recently Used) Cache Manager for localStorage
 * Implements automatic eviction of oldest items when quota is exceeded
 * Tracks access times and item sizes to optimize storage usage
 */

export interface CacheMetadata {
  lastAccessed: number;
  size: number;
  key: string;
}

export interface LRUConfig {
  maxItems?: number;
  maxSizeBytes?: number;
  namespace?: string;
}

const DEFAULT_CONFIG: Required<LRUConfig> = {
  maxItems: 50,
  maxSizeBytes: 5 * 1024 * 1024, // 5MB default
  namespace: "lru_cache",
};

/**
 * Estimate size of an object in bytes
 */
function estimateSize(obj: unknown): number {
  try {
    const json = JSON.stringify(obj);
    return new Blob([json]).size;
  } catch {
    return 0;
  }
}

/**
 * Get metadata key for tracking cache metadata
 */
function getMetadataKey(namespace: string): string {
  return `${namespace}:metadata`;
}

/**
 * Get all cached items metadata
 */
function getMetadata(namespace: string): Record<string, CacheMetadata> {
  try {
    const key = getMetadataKey(namespace);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Save metadata to localStorage
 */
function saveMetadata(
  namespace: string,
  metadata: Record<string, CacheMetadata>
): void {
  try {
    const key = getMetadataKey(namespace);
    localStorage.setItem(key, JSON.stringify(metadata));
  } catch {
    console.warn("Failed to save cache metadata");
  }
}

/**
 * Evict least recently used items until size/count is under limits
 */
function evictIfNeeded(
  namespace: string,
  config: Required<LRUConfig>
): void {
  const metadata = getMetadata(namespace);
  const keys = Object.keys(metadata);

  // Check if we're over limits
  const itemCount = keys.length;
  const totalSize = Object.values(metadata).reduce((sum, m) => sum + m.size, 0);
  const isOverItemLimit = itemCount > config.maxItems;
  const isOverSizeLimit = totalSize > config.maxSizeBytes;

  if (!isOverItemLimit && !isOverSizeLimit) {
    return; // Under limits, no need to evict
  }

  // Sort by least recently used (oldest first)
  const sortedKeys = keys.sort(
    (a, b) => metadata[a].lastAccessed - metadata[b].lastAccessed
  );

  const newMetadata = { ...metadata };
  let newTotalSize = totalSize;
  let newCount = itemCount;

  // Evict items until we're under limits
  for (const key of sortedKeys) {
    if (!isOverItemLimit && newTotalSize <= config.maxSizeBytes) {
      break; // Both limits satisfied
    }

    if (
      newTotalSize > config.maxSizeBytes ||
      newCount > config.maxItems * 0.9
    ) {
      // Remove the item
      try {
        localStorage.removeItem(key);
        newTotalSize -= newMetadata[key].size;
        newCount--;
        delete newMetadata[key];
      } catch {
        console.warn(`Failed to remove cache item: ${key}`);
      }
    }
  }

  // Save updated metadata
  if (Object.keys(newMetadata).length !== keys.length) {
    saveMetadata(namespace, newMetadata);
  }
}

/**
 * Set a value in the LRU cache
 */
export function setInCache(
  key: string,
  value: unknown,
  userConfig: LRUConfig = {}
): void {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const namespace = config.namespace;

  try {
    const json = JSON.stringify(value);
    const size = estimateSize(value);

    // Try to set the item
    localStorage.setItem(key, json);

    // Update metadata
    const metadata = getMetadata(namespace);
    metadata[key] = {
      key,
      lastAccessed: Date.now(),
      size,
    };
    saveMetadata(namespace, metadata);

    // Evict if needed
    evictIfNeeded(namespace, config);
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.warn("localStorage quota exceeded, evicting items...");
      evictIfNeeded(namespace, config);

      // Try again after eviction
      try {
        const json = JSON.stringify(value);
        const size = estimateSize(value);
        localStorage.setItem(key, json);

        const metadata = getMetadata(namespace);
        metadata[key] = {
          key,
          lastAccessed: Date.now(),
          size,
        };
        saveMetadata(namespace, metadata);
      } catch (retryError) {
        console.error("Failed to save to cache after eviction:", retryError);
        throw retryError;
      }
    } else {
      throw error;
    }
  }
}

/**
 * Get a value from the LRU cache
 */
export function getFromCache(
  key: string,
  userConfig: LRUConfig = {}
): unknown | null {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const namespace = config.namespace;

  try {
    const value = localStorage.getItem(key);

    if (value !== null) {
      // Update last accessed time
      const metadata = getMetadata(namespace);
      if (metadata[key]) {
        metadata[key].lastAccessed = Date.now();
        saveMetadata(namespace, metadata);
      }

      try {
        return JSON.parse(value);
      } catch {
        // Return raw value if not JSON
        return value;
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to retrieve from cache: ${key}`, error);
    return null;
  }
}

/**
 * Remove a value from the LRU cache
 */
export function removeFromCache(
  key: string,
  userConfig: LRUConfig = {}
): void {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const namespace = config.namespace;

  try {
    localStorage.removeItem(key);

    const metadata = getMetadata(namespace);
    delete metadata[key];
    saveMetadata(namespace, metadata);
  } catch (error) {
    console.error(`Failed to remove from cache: ${key}`, error);
  }
}

/**
 * Clear all items in a specific namespace
 */
export function clearCache(userConfig: LRUConfig = {}): void {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const namespace = config.namespace;

  try {
    const metadata = getMetadata(namespace);
    for (const key of Object.keys(metadata)) {
      try {
        localStorage.removeItem(key);
      } catch {
        console.warn(`Failed to clear cache item: ${key}`);
      }
    }

    // Clear metadata
    localStorage.removeItem(getMetadataKey(namespace));
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(userConfig: LRUConfig = {}): {
  itemCount: number;
  totalSize: number;
  maxItems: number;
  maxSizeBytes: number;
  utilizationPercent: number;
} {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const namespace = config.namespace;

  const metadata = getMetadata(namespace);
  const itemCount = Object.keys(metadata).length;
  const totalSize = Object.values(metadata).reduce((sum, m) => sum + m.size, 0);
  const utilizationPercent = (totalSize / config.maxSizeBytes) * 100;

  return {
    itemCount,
    totalSize,
    maxItems: config.maxItems,
    maxSizeBytes: config.maxSizeBytes,
    utilizationPercent,
  };
}
