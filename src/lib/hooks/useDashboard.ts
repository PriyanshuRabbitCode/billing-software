import { useState, useEffect, useCallback } from 'react';

interface DashboardStats {
  customers: number;
  cards: number;
  transactions: number;
  pending: number;
  revenue: number;
}

interface CardPendingAmounts {
  total_pending: number;
  total_received: number;
  updated_cards: number;
}

interface DashboardData {
  stats: DashboardStats;
  recent: any[];
  cardPendingAmounts: CardPendingAmounts;
  upcomingDueDates: any[];
  cached: boolean;
  timestamp: number;
}

interface UseDashboardOptions {
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate?: string;
  endDate?: string;
  forceRefresh?: boolean;
}

interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
}

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const { 
    period = 'monthly', 
    startDate, 
    endDate, 
    forceRefresh = false 
  } = options;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (forceRefresh) params.append('refresh', 'true');
    
    return `/api/dashboard?${params.toString()}`;
  }, [period, startDate, endDate, forceRefresh]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = buildUrl();
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: DashboardData = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const refetch = useCallback(async () => {
    // Force refresh by adding refresh parameter
    const url = buildUrl();
    const refreshUrl = url.includes('?') ? `${url}&refresh=true` : `${url}?refresh=true`;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(refreshUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: DashboardData = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const invalidateCache = useCallback(async () => {
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate-cache' })
      });
      
      // Refetch data after cache invalidation
      await refetch();
    } catch (err: any) {
      console.error('Failed to invalidate cache:', err);
    }
  }, [refetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidateCache
  };
}

// Helper function to invalidate dashboard cache when transactions are modified
export async function invalidateDashboardCache(): Promise<void> {
  try {
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalidate-cache' })
    });
  } catch (error) {
    console.error('Failed to invalidate dashboard cache:', error);
  }
}
