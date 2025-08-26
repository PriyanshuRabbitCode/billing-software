// Simple cache utility for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  // Get cached data if it exists and is not expired
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Set cache entry
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Clear specific cache entry
  delete(key: string): void {
    this.cache.delete(key);
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const apiCache = new APICache();

// Cache keys
export const CACHE_KEYS = {
  CARD_PENDING_AMOUNTS: 'card-pending-amounts',
  CARD_PENDING_AMOUNTS_TOTAL: 'card-pending-amounts-total',
  CUSTOMER_CARDS: (customerId: string) => `customer-cards-${customerId}`,
  CUSTOMER_DATA: (customerId: string) => `customer-data-${customerId}`,
  CARD_PENDING_FOR_CARD: (cardNumber: string) => `card-pending-${cardNumber}`,
  STATS: (period: string, startDate?: string, endDate?: string) => 
    `stats-${period}-${startDate || ''}-${endDate || ''}`,
  DASHBOARD: (period: string, startDate?: string, endDate?: string) => 
    `dashboard-${period}-${startDate || ''}-${endDate || ''}`,
  CUSTOMERS: (include: string, customerId?: string, limit?: string, offset?: string, search?: string) => 
    `customers-${include}-${customerId || 'all'}-${limit || '1000'}-${offset || '0'}-${search || ''}`,
} as const;

// Helper function to create cache key with parameters
export function createCacheKey(baseKey: string, ...params: any[]): string {
  return `${baseKey}-${params.join('-')}`;
}

// Helper function to invalidate related cache entries
export function invalidateCardPendingCache(): void {
  // Clear all card pending related cache
  const keysToDelete: string[] = [];
  for (const [key] of apiCache['cache']) {
    if (key.includes('card-pending')) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => apiCache.delete(key));
}

// Helper function to invalidate dashboard cache
export function invalidateDashboardCache(): void {
  // Clear all dashboard related cache
  const keysToDelete: string[] = [];
  for (const [key] of apiCache['cache']) {
    if (key.startsWith('dashboard-')) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => apiCache.delete(key));
}

// Helper function to invalidate all cache when transactions are modified
export function invalidateTransactionCache(): void {
  invalidateCardPendingCache();
  invalidateDashboardCache();
}

// Helper function to invalidate all cache when customers are modified
export function invalidateCustomerCache(): void {
  // Clear all customer related cache
  const keysToDelete: string[] = [];
  for (const [key] of apiCache['cache']) {
    if (key.startsWith('customers-')) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => apiCache.delete(key));
}

// Helper function to invalidate all cache when any data is modified
export function invalidateAllCache(): void {
  invalidateCardPendingCache();
  invalidateDashboardCache();
  invalidateCustomerCache();
}
