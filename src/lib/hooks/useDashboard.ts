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
  cardDetails: any[]; // New: card details with customer info
  customers: any[]; // New: customer data for reuse
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
      
      const result = await response.json();
      
      if (result.success) {
        // Transform the new API response to match the expected format
        const transformedData: DashboardData = {
          stats: {
            customers: result.data.totalCustomers,
            cards: result.data.totalCards,
            transactions: result.data.totalTransactions,
            pending: result.data.totalPendingAmount,
            revenue: result.data.monthlyStats.totalProfit
          },
          recent: result.data.recentTransactions,
          cardPendingAmounts: {
            total_pending: result.data.totalPendingAmount,
            total_received: 0, // Not available in new API
            updated_cards: 0 // Not available in new API
          },
          upcomingDueDates: result.data.upcomingDueDates,
          cardDetails: [], // Will be fetched separately if needed
          customers: [], // Will be fetched separately if needed
          cached: false,
          timestamp: Date.now()
        };
        setData(transformedData);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
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
      
      const result = await response.json();
      
      if (result.success) {
        // Transform the new API response to match the expected format
        const transformedData: DashboardData = {
          stats: {
            customers: result.data.totalCustomers,
            cards: result.data.totalCards,
            transactions: result.data.totalTransactions,
            pending: result.data.totalPendingAmount,
            revenue: result.data.monthlyStats.totalProfit
          },
          recent: result.data.recentTransactions,
          cardPendingAmounts: {
            total_pending: result.data.totalPendingAmount,
            total_received: 0, // Not available in new API
            updated_cards: 0 // Not available in new API
          },
          upcomingDueDates: result.data.upcomingDueDates,
          cardDetails: [], // Will be fetched separately if needed
          customers: [], // Will be fetched separately if needed
          cached: false,
          timestamp: Date.now()
        };
        setData(transformedData);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const invalidateCache = useCallback(async () => {
    // Simply refetch data since we don't have caching in the new API
    await refetch();
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
  // No-op since we don't have caching in the new API
  console.log('Cache invalidation not needed in new API structure');
}
