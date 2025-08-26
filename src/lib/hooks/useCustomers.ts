import { useState, useEffect, useCallback } from 'react';

interface Customer {
  id: number;
  full_name: string;
  email_id: string;
  contact_no: string;
  pan_no: string;
  aadhaar_no: string;
  created_at: string;
  updated_at: string;
  card_due_date?: string;
  // Relational data (when include=relations)
  tax_details?: any[];
  identity_documents?: any[];
  accounts?: any[];
  cards?: any[];
  transactions?: any[];
  card_pending_amounts?: any[];
}

interface CustomerResponse {
  data: Customer[];
  cached: boolean;
  timestamp: number;
}

interface UseCustomersOptions {
  include?: 'basic' | 'relations';
  customerId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  forceRefresh?: boolean;
}

interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
  cached: boolean;
  timestamp: number;
}

// Global customer cache to share data across components
let globalCustomerCache: Customer[] = [];
let globalCustomerCacheTimestamp = 0;
let globalCustomerCachePromise: Promise<Customer[]> | null = null;

export function useCustomers(options: UseCustomersOptions = {}): UseCustomersResult {
  const { 
    include = 'basic', 
    customerId, 
    limit = 1000, 
    offset = 0, 
    search, 
    forceRefresh = false 
  } = options;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [timestamp, setTimestamp] = useState(0);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (include === 'relations') params.append('include', 'relations');
    if (customerId) params.append('id', customerId.toString());
    if (limit !== 1000) params.append('limit', limit.toString());
    if (offset !== 0) params.append('offset', offset.toString());
    if (search) params.append('search', search);
    if (forceRefresh) params.append('refresh', 'true');
    
    return `/api/customers?${params.toString()}`;
  }, [include, customerId, limit, offset, search, forceRefresh]);

  const fetchCustomers = useCallback(async () => {
    // If we're fetching basic customer data and have a recent cache, use it
    if (include === 'basic' && !customerId && !search && !forceRefresh && 
        globalCustomerCache.length > 0 && 
        Date.now() - globalCustomerCacheTimestamp < 5 * 60 * 1000) {
      setCustomers(globalCustomerCache);
      setCached(true);
      setTimestamp(globalCustomerCacheTimestamp);
      setError(null);
      return;
    }

    // If there's already a fetch in progress, wait for it
    if (globalCustomerCachePromise && include === 'basic' && !customerId && !search) {
      setLoading(true);
      try {
        const cachedCustomers = await globalCustomerCachePromise;
        setCustomers(cachedCustomers);
        setCached(true);
        setTimestamp(globalCustomerCacheTimestamp);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch customers');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = buildUrl();
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: CustomerResponse = await response.json();
      
      // Update global cache for basic customer data
      if (include === 'basic' && !customerId && !search) {
        globalCustomerCache = result.data;
        globalCustomerCacheTimestamp = result.timestamp;
      }
      
      setCustomers(result.data);
      setCached(result.cached);
      setTimestamp(result.timestamp);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, include, customerId, search, forceRefresh]);

  const refetch = useCallback(async () => {
    // Clear global cache to force fresh fetch
    if (include === 'basic' && !customerId && !search) {
      globalCustomerCache = [];
      globalCustomerCacheTimestamp = 0;
      globalCustomerCachePromise = null;
    }
    
    const url = buildUrl();
    const refreshUrl = url.includes('?') ? `${url}&refresh=true` : `${url}?refresh=true`;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(refreshUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: CustomerResponse = await response.json();
      
      // Update global cache for basic customer data
      if (include === 'basic' && !customerId && !search) {
        globalCustomerCache = result.data;
        globalCustomerCacheTimestamp = result.timestamp;
      }
      
      setCustomers(result.data);
      setCached(result.cached);
      setTimestamp(result.timestamp);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, include, customerId, search]);

  const invalidateCache = useCallback(async () => {
    try {
      await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate-cache' })
      });
      
      // Clear global cache
      globalCustomerCache = [];
      globalCustomerCacheTimestamp = 0;
      globalCustomerCachePromise = null;
      
      // Refetch data
      await refetch();
    } catch (err: any) {
      console.error('Failed to invalidate cache:', err);
    }
  }, [refetch]);

  useEffect(() => {
    // For basic customer data without specific filters, use global cache promise
    if (include === 'basic' && !customerId && !search && !forceRefresh) {
      if (globalCustomerCachePromise) {
        setLoading(true);
        globalCustomerCachePromise.then(cachedCustomers => {
          setCustomers(cachedCustomers);
          setCached(true);
          setTimestamp(globalCustomerCacheTimestamp);
          setError(null);
          setLoading(false);
        }).catch(err => {
          setError(err.message || 'Failed to fetch customers');
          setLoading(false);
        });
      } else {
        globalCustomerCachePromise = fetchCustomers().then(() => globalCustomerCache);
        fetchCustomers();
      }
    } else {
      fetchCustomers();
    }
  }, [fetchCustomers, include, customerId, search, forceRefresh]);

  return {
    customers,
    loading,
    error,
    refetch,
    invalidateCache,
    cached,
    timestamp
  };
}

// Helper function to invalidate customer cache when customers are modified
export async function invalidateCustomerCache(): Promise<void> {
  try {
    await fetch('/api/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalidate-cache' })
    });
    
    // Clear global cache
    globalCustomerCache = [];
    globalCustomerCacheTimestamp = 0;
    globalCustomerCachePromise = null;
  } catch (error) {
    console.error('Failed to invalidate customer cache:', error);
  }
}

// Helper function to get a single customer with relations
export function useCustomer(customerId: number, includeRelations: boolean = false) {
  const { customers, loading, error, refetch, invalidateCache, cached, timestamp } = useCustomers({
    customerId,
    include: includeRelations ? 'relations' : 'basic'
  });

  return {
    customer: customers[0] || null,
    loading,
    error,
    refetch,
    invalidateCache,
    cached,
    timestamp
  };
}
