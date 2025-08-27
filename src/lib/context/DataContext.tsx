"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';

// Data types
interface Customer {
  id: number;
  full_name: string;
  email_id: string;
  contact_no: string;
  pan_no?: string;
  aadhaar_no?: string;
  billing_address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  created_at: string;
  updated_at: string;
  card_due_date?: string;
  // Relations
  tax_details?: any[];
  identity_documents?: any[];
  accounts?: any[];
  cards?: any[];
  transactions?: any[];
  card_pending_amounts?: any[];
}

interface Transaction {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  customer_contact?: string;
  card_number?: string;
  transaction_date: string;
  transaction_type: string;
  deposit_amount?: number;
  withdraw_amount?: number;
  base_amount?: number;
  tax_amount?: number;
  profit_amount?: number;
  pending_amount?: number;
  payable_amount?: number;
  status: string;
  pos_type?: string;
  tax_rate?: number;
  created_at: string;
  updated_at: string;
}

interface CardDetail {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  customer_contact?: string;
  bank_name: string;
  card_type: string;
  card_name: string;
  card_number: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

interface DashboardStats {
  customers: number;
  cards: number;
  transactions: number;
  pending: number;
  revenue: number;
}

interface DashboardData {
  stats: DashboardStats;
  recent: Transaction[];
  cardPendingAmounts: {
    total_pending: number;
    total_received: number;
    updated_cards: number;
  };
  upcomingDueDates: any[];
  cardDetails: CardDetail[];
  customers: Customer[];
  transactions: Transaction[];
}

// State interface
interface DataState {
  customers: Customer[];
  transactions: Transaction[];
  cardDetails: CardDetail[];
  dashboard: DashboardData | null;
  loading: {
    customers: boolean;
    transactions: boolean;
    cardDetails: boolean;
    dashboard: boolean;
  };
  error: {
    customers: string | null;
    transactions: string | null;
    cardDetails: string | null;
    dashboard: string | null;
  };
  cache: {
    customers: number;
    transactions: number;
    cardDetails: number;
    dashboard: number;
  };
}

// Action types
type DataAction =
  | { type: 'SET_CUSTOMERS'; payload: Customer[] }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_CARD_DETAILS'; payload: CardDetail[] }
  | { type: 'SET_DASHBOARD'; payload: DashboardData }
  | { type: 'SET_LOADING'; payload: { key: keyof DataState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof DataState['error']; value: string | null } }
  | { type: 'UPDATE_CACHE'; payload: { key: keyof DataState['cache']; value: number } }
  | { type: 'CLEAR_CACHE' };

// Initial state
const initialState: DataState = {
  customers: [],
  transactions: [],
  cardDetails: [],
  dashboard: null,
  loading: {
    customers: false,
    transactions: false,
    cardDetails: false,
    dashboard: false,
  },
  error: {
    customers: null,
    transactions: null,
    cardDetails: null,
    dashboard: null,
  },
  cache: {
    customers: 0,
    transactions: 0,
    cardDetails: 0,
    dashboard: 0,
  },
};

// Reducer
function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SET_CUSTOMERS':
      return {
        ...state,
        customers: action.payload,
        cache: { ...state.cache, customers: Date.now() },
      };
    case 'SET_TRANSACTIONS':
      return {
        ...state,
        transactions: action.payload,
        cache: { ...state.cache, transactions: Date.now() },
      };
    case 'SET_CARD_DETAILS':
      return {
        ...state,
        cardDetails: action.payload,
        cache: { ...state.cache, cardDetails: Date.now() },
      };
    case 'SET_DASHBOARD':
      return {
        ...state,
        dashboard: action.payload,
        cache: { ...state.cache, dashboard: Date.now() },
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: { ...state.error, [action.payload.key]: action.payload.value },
      };
    case 'UPDATE_CACHE':
      return {
        ...state,
        cache: { ...state.cache, [action.payload.key]: action.payload.value },
      };
    case 'CLEAR_CACHE':
      return {
        ...state,
        cache: {
          customers: 0,
          transactions: 0,
          cardDetails: 0,
          dashboard: 0,
        },
      };
    default:
      return state;
  }
}

// Context
interface DataContextType {
  state: DataState;
  dispatch: React.Dispatch<DataAction>;
  fetchCustomers: (options?: { include?: string; forceRefresh?: boolean }) => Promise<void>;
  fetchTransactions: (options?: { limit?: number; offset?: number; forceRefresh?: boolean }) => Promise<void>;
  fetchCardDetails: (options?: { forceRefresh?: boolean }) => Promise<void>;
  fetchDashboard: (options?: { include?: string; period?: string; forceRefresh?: boolean }) => Promise<void>;
  getCustomerById: (id: number) => Customer | undefined;
  getTransactionById: (id: number) => Transaction | undefined;
  getCardDetailById: (id: number) => CardDetail | undefined;
  invalidateCache: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Provider component
interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // Check if cache is still valid (30 seconds for transactions, 1 minute for others)
  const isCacheValid = (cacheTime: number, type: 'transactions' | 'other') => {
    const now = Date.now();
    const ttl = type === 'transactions' ? 30 * 1000 : 60 * 1000;
    return now - cacheTime < ttl;
  };

  // Fetch customers
  const fetchCustomers = useCallback(async (options: { include?: string; forceRefresh?: boolean } = {}) => {
    const { include = 'basic', forceRefresh = false } = options;
    
    // Check cache first
    if (!forceRefresh && state.customers && state.customers.length > 0 && isCacheValid(state.cache.customers, 'other')) {
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'customers', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'customers', value: null } });

    try {
      const params = new URLSearchParams();
      if (include === 'relations') params.append('include', 'relations');
      if (forceRefresh) params.append('refresh', 'true');

      const response = await fetch(`/api/customers?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success) {
        dispatch({ type: 'SET_CUSTOMERS', payload: result.data });
      } else {
        throw new Error(result.error || 'Failed to fetch customers');
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { key: 'customers', value: error instanceof Error ? error.message : 'Failed to fetch customers' } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'customers', value: false } });
    }
  }, [state.customers?.length, state.cache.customers]);

  // Fetch transactions
  const fetchTransactions = useCallback(async (options: { limit?: number; offset?: number; forceRefresh?: boolean } = {}) => {
    const { limit = 1000, offset = 0, forceRefresh = false } = options;
    
    // Check cache first
    if (!forceRefresh && state.transactions && state.transactions.length > 0 && isCacheValid(state.cache.transactions, 'transactions')) {
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'transactions', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'transactions', value: null } });

    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (forceRefresh) params.append('refresh', 'true');

      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success) {
        dispatch({ type: 'SET_TRANSACTIONS', payload: result.data });
      } else {
        throw new Error(result.error || 'Failed to fetch transactions');
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { key: 'transactions', value: error instanceof Error ? error.message : 'Failed to fetch transactions' } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'transactions', value: false } });
    }
  }, [state.transactions?.length, state.cache.transactions]);

  // Fetch card details
  const fetchCardDetails = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    const { forceRefresh = false } = options;
    
    // Check cache first
    if (!forceRefresh && state.cardDetails && state.cardDetails.length > 0 && isCacheValid(state.cache.cardDetails, 'other')) {
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'cardDetails', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'cardDetails', value: null } });

    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.append('refresh', 'true');

      const response = await fetch(`/api/cards?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success) {
        dispatch({ type: 'SET_CARD_DETAILS', payload: result.data });
      } else {
        throw new Error(result.error || 'Failed to fetch card details');
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { key: 'cardDetails', value: error instanceof Error ? error.message : 'Failed to fetch card details' } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'cardDetails', value: false } });
    }
  }, [state.cardDetails?.length, state.cache.cardDetails]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async (options: { period?: string; forceRefresh?: boolean } = {}) => {
    const { period = 'monthly', forceRefresh = false } = options;
    
    // Check cache first
    if (!forceRefresh && state.dashboard && isCacheValid(state.cache.dashboard, 'other')) {
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'dashboard', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'dashboard', value: null } });

    try {
      const params = new URLSearchParams();
      params.append('period', period);
      if (forceRefresh) params.append('refresh', 'true');

      const response = await fetch(`/api/dashboard?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success) {
        // Transform the new dashboard format to match the expected format
        const transformedDashboard = {
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
          cardDetails: [], // Will be fetched separately
          customers: [], // Will be fetched separately
          transactions: [] // Will be fetched separately
        };
        dispatch({ type: 'SET_DASHBOARD', payload: transformedDashboard });
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { key: 'dashboard', value: error instanceof Error ? error.message : 'Failed to fetch dashboard data' } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'dashboard', value: false } });
    }
  }, [state.dashboard, state.cache.dashboard]);

  // Helper functions
  const getCustomerById = useCallback((id: number) => state.customers.find(c => c.id === id), [state.customers]);
  const getTransactionById = useCallback((id: number) => state.transactions.find(t => t.id === id), [state.transactions]);
  const getCardDetailById = useCallback((id: number) => state.cardDetails.find(c => c.id === id), [state.cardDetails]);
  const invalidateCache = useCallback(() => dispatch({ type: 'CLEAR_CACHE' }), []);

  // Initial data fetch
  useEffect(() => {
    fetchDashboard();
  }, []);

  const value: DataContextType = {
    state,
    dispatch,
    fetchCustomers,
    fetchTransactions,
    fetchCardDetails,
    fetchDashboard,
    getCustomerById,
    getTransactionById,
    getCardDetailById,
    invalidateCache,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// Hook to use the context
export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
