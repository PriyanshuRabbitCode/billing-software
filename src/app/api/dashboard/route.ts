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
    const period = searchParams.get('period') || 'monthly';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Simple in-memory cache per period+limit
    const cacheKey = `${period}:${limit}`;
    if (!(global as any).__dashboardCache) {
      (global as any).__dashboardCache = new Map<string, { timestamp: number; payload: any }>();
    }
    const cache: Map<string, { timestamp: number; payload: any }> = (global as any).__dashboardCache;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    const ttlMs = 60 * 1000; // 60s TTL
    if (cached && now - cached.timestamp < ttlMs) {
      return NextResponse.json(cached.payload);
    }

    // Get basic stats
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM card_details) as total_cards,
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT COALESCE(SUM(pending_amount), 0) FROM transactions WHERE pending_amount > 0) as total_pending_amount,
        (SELECT COALESCE(SUM(pending_amount), 0) FROM transactions WHERE pending_amount > 0 AND status = 'Pending') as total_overdue_amount
    `;

    // Get monthly stats
    const monthlyStatsQuery = `
      SELECT 
        COALESCE(SUM(deposit_amount), 0) as total_deposits,
        COALESCE(SUM(withdraw_amount), 0) as total_withdrawals,
        COALESCE(SUM(tax_amount), 0) as total_tax_collected,
        COALESCE(SUM(profit_amount), 0) as total_profit
      FROM transactions 
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;

    // Get recent transactions
    const recentTransactionsQuery = `
      SELECT 
        t.*,
        c.full_name as customer_name,
        cd.card_number,
        cd.card_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN card_details cd ON t.card_number = cd.card_number
      ORDER BY t.created_at DESC
      LIMIT $1
    `;

    // Get upcoming due dates
    const upcomingDueDatesQuery = `
      SELECT 
        cd.*,
        c.full_name as customer_name,
        c.email_id,
        c.contact_no
      FROM card_details cd
      LEFT JOIN customers c ON cd.customer_id = c.id
      WHERE cd.due_date IS NOT NULL 
        AND cd.due_date >= CURRENT_DATE
        AND cd.due_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY cd.due_date ASC
      LIMIT $1
    `;

    // Execute all queries in parallel
    const [statsResult, monthlyResult, recentResult, dueDatesResult] = await Promise.all([
      query(statsQuery),
      query(monthlyStatsQuery),
      query(recentTransactionsQuery, [limit]),
      query(upcomingDueDatesQuery, [limit])
    ]);

    const stats = statsResult.rows[0];
    const monthlyStats = monthlyResult.rows[0];

    const dashboardData: DashboardStats = {
      totalCustomers: parseInt(stats.total_customers) || 0,
      totalCards: parseInt(stats.total_cards) || 0,
      totalTransactions: parseInt(stats.total_transactions) || 0,
      totalPendingAmount: parseFloat(stats.total_pending_amount) || 0,
      totalOverdueAmount: parseFloat(stats.total_overdue_amount) || 0,
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

    cache.set(cacheKey, { timestamp: now, payload });

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
