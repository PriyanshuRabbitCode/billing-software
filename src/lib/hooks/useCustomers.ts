import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Customer {
  id: number;
  full_name: string;
  email_id: string;
  contact_no: string;
  pan_no: string;
  aadhaar_no: string;
  created_at: string;
  updated_at: string;
  // card_due_date removed; use next_due_date or due_day
  next_due_date?: string;
  // Add aggregated due day (minimum due_day from customer cards)
  due_day?: number;
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
  customerIds?: number[]; // New: batch fetching
  limit?: number;
  offset?: number;
  search?: string;
  forceRefresh?: boolean;
  enabled?: boolean; // New: control query execution
  includes?: Array<'cards' | 'transactions' | 'accounts' | 'tax_details' | 'identity_documents' | 'card_pending_amounts'>; // Explicit relation includes
}

interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Global customer cache to share data across components
let globalCustomerCache: Customer[] = [];
let globalCustomerCacheTimestamp = 0;

export function useCustomers(options: UseCustomersOptions = {}): UseCustomersResult {
  const { 
    include = 'basic', 
    customerId, 
    customerIds,
    limit = 1000, 
    offset = 0, 
    search, 
    forceRefresh = false,
    enabled = true // default enabled
  } = options;

  const buildUrl = useMemo(() => {
    const params = new URLSearchParams();
    // Map include flag to explicit includes if needed
    if (include === 'relations') {
      params.append('include', 'cards,transactions,accounts,tax_details,identity_documents,card_pending_amounts');
    }
    if (options.includes && options.includes.length > 0) {
      params.set('include', options.includes.join(','));
    }
    if (customerId) params.append('id', customerId.toString());
    if (customerIds && customerIds.length > 0) params.append('ids', customerIds.join(','));
    if (limit !== 1000) params.append('limit', limit.toString());
    if (offset !== 0) params.append('offset', offset.toString());
    if (search) params.append('search', search);
    if (forceRefresh) params.append('refresh', 'true');
    const qs = params.toString();
    return qs ? `/api/customers?${qs}` : `/api/customers`;
  }, [include, customerId, customerIds, limit, offset, search, forceRefresh, options.includes]);

  const queryKey = useMemo(() => [
    'customers', include, customerId || null, (customerIds || []).join(',') || null, limit, offset, search || null, (options.includes || []).join(',') || null
  ], [include, customerId, customerIds, limit, offset, search, options.includes]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(buildUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result: CustomerResponse = await response.json();
      // Update legacy global cache for basic list to interop with existing logic if needed
      if (include === 'basic' && !customerId && !customerIds && !search) {
        globalCustomerCache = result.data;
        globalCustomerCacheTimestamp = result.timestamp;
      }
      return result.data as Customer[];
    },
    staleTime: 5 * 60 * 1000,
    enabled, // respect enabled flag
  });

  return {
    customers: (query.data as Customer[]) || [],
    loading: query.isLoading,
    error: (query.error as any)?.message || null,
    refetch: async () => { await query.refetch(); },
  };
}

// Helper function to invalidate customer cache when customers are modified
export async function invalidateCustomerCache(): Promise<void> {
  // With React Query, invalidation is handled at call sites via queryClient.invalidateQueries
  globalCustomerCache = [];
  globalCustomerCacheTimestamp = 0;
}

// Helper function to get a single customer with relations
export function useCustomer(customerId: number, includeRelations: boolean = false, enabled: boolean = true) {
  const relationIncludes: Array<'cards' | 'transactions' | 'accounts' | 'tax_details' | 'identity_documents' | 'card_pending_amounts'> = includeRelations
    ? ['cards', 'transactions', 'accounts', 'tax_details', 'identity_documents', 'card_pending_amounts']
    : [];
  const { customers, loading, error, refetch } = useCustomers({
    customerId,
    include: includeRelations ? 'relations' : 'basic',
    enabled,
    includes: relationIncludes.length ? relationIncludes : undefined,
  });

  return {
    customer: customers[0] || null,
    loading,
    error,
    refetch
  };
}

// Helper function to get multiple customers by IDs
export function useCustomersByIds(customerIds: number[], includeRelations: boolean = false) {
  const { customers, loading, error, refetch } = useCustomers({
    customerIds,
    include: includeRelations ? 'relations' : 'basic'
  });

  return {
    customers,
    loading,
    error,
    refetch
  };
}
