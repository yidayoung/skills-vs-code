export interface CacheEntry {
  cachedAt: string;    // ISO 8601 timestamp
  repositoryUrl: string;
}

export interface CacheIndex {
  skills: Record<string, CacheEntry>;
}

export interface CacheConfig {
  ttl: number;           // Time to live in milliseconds (default: 24 hours)
  maxCount: number;      // Maximum number of cached skills (default: 100)
}
