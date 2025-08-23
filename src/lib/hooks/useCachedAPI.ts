import { useState, useEffect, useCallback } from 'react';
import { apiCache, CACHE_KEYS } from '../cache';

interface UseCachedAPIOptions {
  ttl?: number; // Time to live in milliseconds
  dependencies?: any[]; // React dependencies for re-fetching
  skip?: boolean; // Skip the API call
}

interface UseCachedAPIResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
}

export function useCachedAPI<T>(
  url: string,
  cacheKey: string,
  options: UseCachedAPIOptions = {}
): UseCachedAPIResult<T> {
  const { ttl, dependencies = [], skip = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (skip) return;

    // Check cache first
    const cachedData = apiCache.get<T>(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Cache the result
      apiCache.set(cacheKey, result, ttl);
      
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url, cacheKey, ttl, skip]);

  const refetch = useCallback(async () => {
    // Clear cache and fetch fresh data
    apiCache.delete(cacheKey);
    await fetchData();
  }, [cacheKey, fetchData]);

  const invalidateCache = useCallback(() => {
    apiCache.delete(cacheKey);
  }, [cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidateCache
  };
}

// Specialized hooks for common API calls
export function useCardPendingAmounts() {
  return useCachedAPI(
    '/api/card-pending-amounts',
    CACHE_KEYS.CARD_PENDING_AMOUNTS,
    { ttl: 2 * 60 * 1000 } // 2 minutes TTL
  );
}

export function useCardPendingAmountsTotal() {
  return useCachedAPI(
    '/api/card-pending-amounts',
    CACHE_KEYS.CARD_PENDING_AMOUNTS_TOTAL,
    { 
      ttl: 2 * 60 * 1000, // 2 minutes TTL
      skip: false // We'll handle this differently for POST request
    }
  );
}

export function useCustomerCards(customerId: string) {
  return useCachedAPI(
    `/api/customer-cards/${customerId}`,
    CACHE_KEYS.CUSTOMER_CARDS(customerId),
    { ttl: 5 * 60 * 1000 } // 5 minutes TTL
  );
}

export function useCustomerData(customerId: string) {
  return useCachedAPI(
    `/api/customers/${customerId}`,
    CACHE_KEYS.CUSTOMER_DATA(customerId),
    { ttl: 10 * 60 * 1000 } // 10 minutes TTL
  );
}

export function useCardPendingForCard(cardNumber: string) {
  return useCachedAPI(
    `/api/card-pending-amounts?card_number=${cardNumber}`,
    CACHE_KEYS.CARD_PENDING_FOR_CARD(cardNumber),
    { ttl: 2 * 60 * 1000 } // 2 minutes TTL
  );
}

export function useStats(period: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  return useCachedAPI(
    `/api/stats?${params.toString()}`,
    CACHE_KEYS.STATS(period, startDate, endDate),
    { ttl: 1 * 60 * 1000 } // 1 minute TTL
  );
}
