import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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
}

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const { 
    period = 'monthly', 
    startDate, 
    endDate, 
    forceRefresh = false 
  } = options;

  const buildUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (forceRefresh) params.append('refresh', 'true');
    
    const qs = params.toString();
    return qs ? `/api/dashboard?${qs}` : `/api/dashboard`;
  }, [period, startDate, endDate, forceRefresh]);
  const queryKey = useMemo(() => ["dashboard", period, startDate || null, endDate || null], [period, startDate, endDate]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(buildUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch dashboard data');
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
          total_received: 0,
          updated_cards: 0
        },
        upcomingDueDates: result.data.upcomingDueDates,
        cardDetails: [],
        customers: [],
        cached: false,
        timestamp: typeof window !== 'undefined' ? Date.now() : 0
      };
      return transformedData;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: (query.data as DashboardData) || null,
    loading: query.isLoading,
    error: (query.error as any)?.message || null,
    refetch: async () => { await query.refetch(); },
  };
}

// Helper function to invalidate dashboard cache when transactions are modified
export async function invalidateDashboardCache(): Promise<void> {
  // No-op since we don't have caching in the new API
  console.log('Cache invalidation not needed in new API structure');
}
