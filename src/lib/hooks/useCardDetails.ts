import { useState, useEffect, useCallback } from 'react';
import { apiCache } from '@/lib/cache';

interface CardDetailsData {
  cardDetails: any[];
  customers: any[];
  loading: boolean;
  error: string | null;
  cached: boolean;
  timestamp: number;
  refetch: () => void;
}

export function useCardDetails(): CardDetailsData {
  const [cardDetails, setCardDetails] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [timestamp, setTimestamp] = useState(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Use the optimized dashboard API with card details and customers included
      const url = `/api/dashboard?include=all${forceRefresh ? '&refresh=true' : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch card details: ${response.status}`);
      }

      const data = await response.json();
      
      setCardDetails(data.cardDetails || []);
      setCustomers(data.customers || []);
      setCached(data.cached || false);
      setTimestamp(data.timestamp || Date.now());

    } catch (err) {
      console.error('Error fetching card details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch card details');
      setCardDetails([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    cardDetails,
    customers,
    loading,
    error,
    cached,
    timestamp,
    refetch
  };
}
