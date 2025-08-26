import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { apiCache } from '@/lib/cache';

export const runtime = 'nodejs';

interface DashboardResponse {
  stats: {
    customers: number;
    cards: number;
    transactions: number;
    pending: number;
    revenue: number;
  };
  recent: any[];
  cardPendingAmounts: {
    total_pending: number;
    total_received: number;
    updated_cards: number;
  };
  upcomingDueDates: any[];
  cardDetails: any[]; // New: card details with customer info
  customers: any[]; // New: customer data for reuse
  cached: boolean;
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const forceRefresh = searchParams.get('refresh') === 'true';
    const includeCardDetails = searchParams.get('include') === 'card_details' || searchParams.get('include') === 'all';
    const includeCustomers = searchParams.get('include') === 'customers' || searchParams.get('include') === 'all';
    
    // Create cache key
    const cacheKey = `dashboard-${period}-${customStartDate || ''}-${customEndDate || ''}-${includeCardDetails ? 'cards' : ''}-${includeCustomers ? 'customers' : ''}`;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = apiCache.get<DashboardResponse>(cacheKey);
      if (cachedData) {
        return NextResponse.json({
          ...cachedData,
          cached: true
        });
      }
    }
    
    // Calculate date range based on period or custom dates
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = now;
      
      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }
    
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // Build queries array based on what's needed
    const queries: Promise<any>[] = [
      // Stats queries (always needed)
      Promise.all([
        query<{ count: string }>(
          `SELECT COUNT(DISTINCT c.id)::int as count 
           FROM customers c
           WHERE c.created_at >= $1 AND c.created_at <= $2`,
          [startDateStr, endDateStr]
        ),
        query<{ count: string }>(
          `SELECT COUNT(DISTINCT cd.id)::int as count 
           FROM card_details cd
           WHERE EXISTS (
             SELECT 1 FROM transactions t 
             WHERE t.card_number = cd.card_number 
             AND t.customer_id = cd.customer_id
             AND t.transaction_date >= $1 AND t.transaction_date <= $2
           )`,
          [startDateStr, endDateStr]
        ),
        query<{ count: string }>(
          `SELECT COUNT(*)::int as count FROM transactions WHERE transaction_date >= $1 AND transaction_date <= $2`,
          [startDateStr, endDateStr]
        ),
        query<{ total: string | null }>(
          `SELECT COALESCE(SUM(t.pending_amount),0) as total 
           FROM transactions t
           WHERE t.transaction_date >= $1 AND t.transaction_date <= $2`,
          [startDateStr, endDateStr]
        ),
        query<{ revenue: string | null }>(
          `SELECT COALESCE(SUM(profit_amount),0) as revenue FROM transactions WHERE transaction_date >= $1 AND transaction_date <= $2`,
          [startDateStr, endDateStr]
        )
      ]),
      
      // Recent transactions (always needed)
      query(
        `SELECT t.id, t.payable_amount, t.status, t.transaction_date, c.full_name AS customer_name, 
                t.pending_amount
         FROM transactions t
         LEFT JOIN customers c ON c.id = t.customer_id
         WHERE t.transaction_date >= $1 AND t.transaction_date <= $2
         ORDER BY t.transaction_date DESC
         LIMIT 5`,
        [startDateStr, endDateStr]
      ),
      
      // Card pending amounts calculation (always needed)
      query(`
        WITH transaction_totals AS (
          SELECT 
            customer_id,
            card_number,
            SUM(CASE WHEN transaction_type = 'debit' THEN base_amount ELSE 0 END) as total_debits,
            SUM(CASE WHEN transaction_type = 'credit' THEN base_amount ELSE 0 END) as total_credits
          FROM transactions 
          WHERE card_number IS NOT NULL AND card_number != ''
          GROUP BY customer_id, card_number
        ),
        card_names AS (
          SELECT DISTINCT cd.customer_id, cd.card_number, cd.card_name
          FROM card_details cd
          WHERE cd.card_number IS NOT NULL AND cd.card_number != ''
        )
        INSERT INTO card_pending_amounts (customer_id, card_number, card_name, pending_amount, received_amount)
        SELECT 
          tt.customer_id,
          tt.card_number,
          COALESCE(cn.card_name, 'Unknown Card') as card_name,
          COALESCE(tt.total_debits, 0) - COALESCE(tt.total_credits, 0) as pending_amount,
          COALESCE(tt.total_credits, 0) as received_amount
        FROM transaction_totals tt
        LEFT JOIN card_names cn ON cn.customer_id = tt.customer_id AND cn.card_number = tt.card_number
        ON CONFLICT (customer_id, card_number) 
        DO UPDATE SET 
          pending_amount = EXCLUDED.pending_amount,
          received_amount = EXCLUDED.received_amount,
          card_name = EXCLUDED.card_name,
          updated_at = NOW()
        RETURNING customer_id, card_number, card_name, pending_amount, received_amount
      `),
      
      // Upcoming due dates (always needed)
      query(
        `SELECT 
          cd.due_date,
          cd.card_number,
          cd.card_name,
          c.full_name as customer_name
        FROM card_details cd
        JOIN customers c ON c.id = cd.customer_id
        WHERE cd.due_date >= CURRENT_DATE
        ORDER BY cd.due_date ASC
        LIMIT 5`
      )
    ];

    // Add optional queries based on include parameters
    if (includeCardDetails) {
      queries.push(
        // Card details with customer info
        query(
          `SELECT 
            cd.*,
            c.full_name as customer_name,
            c.email_id as customer_email,
            c.contact_no as customer_contact
          FROM card_details cd
          LEFT JOIN customers c ON c.id = cd.customer_id
          ORDER BY cd.id DESC
          LIMIT 1000`
        )
      );
    }

    if (includeCustomers) {
      queries.push(
        // All customers for reuse
        query(
          `SELECT 
            c.*, 
            (SELECT MIN(cd.due_date) 
             FROM card_details cd 
             WHERE cd.customer_id = c.id) as card_due_date
          FROM customers c
          ORDER BY c.id DESC
          LIMIT 1000`
        )
      );
    }

        // Execute all queries in parallel
    const results = await Promise.all(queries);

    // Extract results based on what was requested
    let resultIndex = 0;
    
    // Stats results (always present)
    const statsResult = results[resultIndex++];
    const [c, a, t, pendingRows, revenueRows] = statsResult;
    
    // Recent transactions (always present)
    const recentResult = results[resultIndex++];
    
    // Card pending amounts (always present)
    const cardPendingResult = results[resultIndex++];
    const cardPendingTotals = cardPendingResult.rows.reduce((acc: { total_pending: number; total_received: number }, row: any) => {
      acc.total_pending += Number(row.pending_amount || 0);
      acc.total_received += Number(row.received_amount || 0);
      return acc;
    }, { total_pending: 0, total_received: 0 });
    
    // Upcoming due dates (always present)
    const upcomingDueDatesResult = results[resultIndex++];
    
    // Optional results
    let cardDetailsResult = { rows: [] };
    let customersResult = { rows: [] };
    
    if (includeCardDetails) {
      cardDetailsResult = results[resultIndex++];
    }
    
    if (includeCustomers) {
      customersResult = results[resultIndex++];
    }

    // Build response object
    const response: DashboardResponse = {
      stats: {
        customers: Number(c.rows[0]?.count ?? 0),
        cards: Number(a.rows[0]?.count ?? 0),
        transactions: Number(t.rows[0]?.count ?? 0),
        pending: Number(pendingRows.rows[0]?.total ?? 0),
        revenue: Number(revenueRows.rows[0]?.revenue ?? 0),
      },
      recent: recentResult.rows,
      cardPendingAmounts: {
        total_pending: cardPendingTotals.total_pending,
        total_received: cardPendingTotals.total_received,
        updated_cards: cardPendingResult.rows.length,
      },
      upcomingDueDates: upcomingDueDatesResult.rows,
      cardDetails: cardDetailsResult.rows,
      customers: customersResult.rows,
      cached: false,
      timestamp: Date.now()
    };

    // Cache the response with different TTL based on period
    let cacheTTL: number;
    switch (period) {
      case 'daily':
        cacheTTL = 2 * 60 * 1000; // 2 minutes
        break;
      case 'weekly':
        cacheTTL = 5 * 60 * 1000; // 5 minutes
        break;
      case 'monthly':
        cacheTTL = 15 * 60 * 1000; // 15 minutes
        break;
      case 'yearly':
        cacheTTL = 30 * 60 * 1000; // 30 minutes
        break;
      default:
        cacheTTL = 10 * 60 * 1000; // 10 minutes
    }

    apiCache.set(cacheKey, response, cacheTTL);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard data' }, 
      { status: 500 }
    );
  }
}

// POST method to invalidate cache when transactions are added/updated
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'invalidate-cache') {
      // Clear all dashboard-related cache
      const keysToDelete: string[] = [];
      for (const [key] of apiCache['cache']) {
        if (key.startsWith('dashboard-')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => apiCache.delete(key));
      
      return NextResponse.json({ 
        success: true, 
        message: 'Dashboard cache invalidated',
        cleared_keys: keysToDelete.length
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error: any) {
    console.error('Dashboard cache invalidation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invalidate cache' }, 
      { status: 500 }
    );
  }
}
