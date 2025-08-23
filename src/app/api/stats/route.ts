import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    
    // Calculate date range based on period or custom dates
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    if (customStartDate && customEndDate) {
      // Use custom date range
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Use period-based date range
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

    const [{ rows: c }, { rows: a }, { rows: t }, { rows: pendingRows }, { rows: revenueRows }, { rows: recentRows }] = await Promise.all([
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
      ),
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
    ]);

    const stats = {
      customers: Number(c[0]?.count ?? 0),
      cards: Number(a[0]?.count ?? 0),
      transactions: Number(t[0]?.count ?? 0),
      pending: Number(pendingRows[0]?.total ?? 0),
      revenue: Number(revenueRows[0]?.revenue ?? 0),
    };

    return NextResponse.json({ stats, recent: recentRows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}



