import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

interface DashboardStats {
  totalCustomers: number;
  totalCards: number;
  totalTransactions: number;
  totalPendingAmount: number;
  totalOverdueAmount: number;
  recentTransactions: any[];
  upcomingDueDates: any[];
  monthlyStats: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalTaxCollected: number;
    totalProfit: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const period = (searchParams.get('period') || 'monthly').toLowerCase();
    const startDateParam = searchParams.get('startDate') || undefined;
    const endDateParam = searchParams.get('endDate') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Compute inclusive date range based on period or custom
    function getDateRange() {
      const now = new Date();
      const setStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const setEndOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      if (period === 'custom') {
        if (!startDateParam || !endDateParam) {
          return { error: 'Please select both From and To dates to filter the data.' };
        }
        const s = new Date(startDateParam);
        const e = new Date(endDateParam);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) {
          return { error: 'Invalid date format provided.' };
        }
        if (s > e) {
          return { error: 'From Date cannot be after To Date.' };
        }
        return { from: setStartOfDay(s), to: setEndOfDay(e) };
      }

      switch (period) {
        case 'daily': {
          const d = new Date();
          return { from: setStartOfDay(d), to: setEndOfDay(d) };
        }
        case 'weekly': {
          const d = new Date();
          // Start of current week (Monday)
          const day = d.getDay(); // 0=Sun, 1=Mon...
          const diffToMonday = day === 0 ? -6 : 1 - day;
          const start = new Date(d);
          start.setDate(d.getDate() + diffToMonday);
          return { from: setStartOfDay(start), to: setEndOfDay(d) };
        }
        case 'monthly': {
          const d = new Date();
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          return { from: setStartOfDay(start), to: setEndOfDay(d) };
        }
        case 'yearly': {
          const d = new Date();
          const start = new Date(d.getFullYear(), 0, 1);
          return { from: setStartOfDay(start), to: setEndOfDay(d) };
        }
        default: {
          const d = new Date();
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          return { from: setStartOfDay(start), to: setEndOfDay(d) };
        }
      }
    }

    const range = getDateRange();
    if ('error' in range) {
      return NextResponse.json({ success: false, error: range.error }, { status: 400 });
    }

    const fromDate = range.from!.toISOString();
    const toDate = range.to!.toISOString();

    // Simple in-memory cache per period+range+limit
    const cacheKey = `${period}:${fromDate}:${toDate}:${limit}`;
    if (!(global as any).__dashboardCache) {
      (global as any).__dashboardCache = new Map<string, { timestamp: number; payload: any }>();
    }
    const cache: Map<string, { timestamp: number; payload: any }> = (global as any).__dashboardCache;
    const cached = cache.get(cacheKey);
    const nowTs = Date.now();
    const ttlMs = 60 * 1000; // 60s TTL
    if (cached && nowTs - cached.timestamp < ttlMs) {
      return NextResponse.json(cached.payload);
    }

    // Aggregated stats within date range
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM customers WHERE created_at >= $1 AND created_at <= $2) as total_customers,
        (SELECT COUNT(*) FROM card_details WHERE created_at >= $1 AND created_at <= $2) as total_cards,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= $1 AND created_at <= $2) as total_transactions,
        (SELECT COALESCE(SUM(pending_amount), 0) FROM transactions WHERE created_at >= $1 AND created_at <= $2 AND pending_amount > 0) as total_pending_amount,
        (SELECT COALESCE(SUM(pending_amount), 0) FROM transactions WHERE created_at >= $1 AND created_at <= $2 AND pending_amount > 0 AND status = 'Pending') as total_overdue_amount,
        (SELECT COALESCE(SUM(profit_amount), 0) FROM transactions WHERE created_at >= $1 AND created_at <= $2) as total_revenue
    `;

    // Recent transactions within range
    const recentTransactionsQuery = `
      SELECT 
        t.*,
        c.full_name as customer_name,
        cd.card_number,
        cd.card_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN card_details cd ON t.card_number = cd.card_number
      WHERE t.created_at >= $1 AND t.created_at <= $2
      ORDER BY t.created_at DESC
      LIMIT $3
    `;

    // Upcoming due dates (next 30 days)
    const upcomingDueDatesQuery = `
      SELECT 
        cd.*, 
        CASE 
          WHEN cd.due_day IS NOT NULL THEN (
            CASE 
              WHEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              ) >= CURRENT_DATE
              THEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
              ELSE make_date(
                EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
            END
          )
          ELSE cd.due_date
        END AS next_due_date,
        c.full_name as customer_name,
        c.email_id,
        c.contact_no
      FROM card_details cd
      LEFT JOIN customers c ON cd.customer_id = c.id
      WHERE (
        CASE 
          WHEN cd.due_day IS NOT NULL THEN (
            CASE 
              WHEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              ) >= CURRENT_DATE
              THEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
              ELSE make_date(
                EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
            END
          )
          ELSE cd.due_date
        END
      ) IS NOT NULL
        AND (
          CASE 
            WHEN cd.due_day IS NOT NULL THEN (
              CASE 
                WHEN make_date(
                  EXTRACT(YEAR FROM CURRENT_DATE)::int,
                  EXTRACT(MONTH FROM CURRENT_DATE)::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                ) >= CURRENT_DATE
                THEN make_date(
                  EXTRACT(YEAR FROM CURRENT_DATE)::int,
                  EXTRACT(MONTH FROM CURRENT_DATE)::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                )
                ELSE make_date(
                  EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                  EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                )
              END
            )
            ELSE cd.due_date
          END
        ) >= CURRENT_DATE
        AND (
          CASE 
            WHEN cd.due_day IS NOT NULL THEN (
              CASE 
                WHEN make_date(
                  EXTRACT(YEAR FROM CURRENT_DATE)::int,
                  EXTRACT(MONTH FROM CURRENT_DATE)::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                ) >= CURRENT_DATE
                THEN make_date(
                  EXTRACT(YEAR FROM CURRENT_DATE)::int,
                  EXTRACT(MONTH FROM CURRENT_DATE)::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                )
                ELSE make_date(
                  EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                  EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                )
              END
            )
            ELSE cd.due_date
          END
        ) <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY next_due_date ASC
      LIMIT $1
    `;

    // Execute queries
    const [statsResult, recentResult, dueDatesResult] = await Promise.all([
      query(statsQuery, [fromDate, toDate]),
      query(recentTransactionsQuery, [fromDate, toDate, limit]),
      query(upcomingDueDatesQuery, [limit])
    ]);

    const stats = statsResult.rows[0] || {};

    // Monthly stats (current month) for backward compatibility
    const monthlyStatsQuery = `
      SELECT 
        COALESCE(SUM(deposit_amount), 0) as total_deposits,
        COALESCE(SUM(withdraw_amount), 0) as total_withdrawals,
        COALESCE(SUM(tax_amount), 0) as total_tax_collected,
        COALESCE(SUM(profit_amount), 0) as total_profit
      FROM transactions 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const monthlyResult = await query(monthlyStatsQuery);
    const monthlyStats = monthlyResult.rows[0] || {};

    const dashboardData = {
      totalCustomers: parseInt(stats.total_customers) || 0,
      totalCards: parseInt(stats.total_cards) || 0,
      totalTransactions: parseInt(stats.total_transactions) || 0,
      totalPendingAmount: parseFloat(stats.total_pending_amount) || 0,
      totalOverdueAmount: parseFloat(stats.total_overdue_amount) || 0,
      totalRevenue: parseFloat(stats.total_revenue) || 0,
      recentTransactions: recentResult.rows || [],
      upcomingDueDates: dueDatesResult.rows || [],
      monthlyStats: {
        totalDeposits: parseFloat(monthlyStats.total_deposits) || 0,
        totalWithdrawals: parseFloat(monthlyStats.total_withdrawals) || 0,
        totalTaxCollected: parseFloat(monthlyStats.total_tax_collected) || 0,
        totalProfit: parseFloat(monthlyStats.total_profit) || 0
      }
    };

    const payload = {
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, { timestamp: nowTs, payload });

    return NextResponse.json(payload);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
