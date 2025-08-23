import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

// Calculate pending amount for a specific customer
export async function POST(req: NextRequest) {
  try {
    const { customer_id } = await req.json();
    
    if (!customer_id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // Calculate pending amount based on transaction history
    // Tax is always paid immediately, so pending amount is based on base amounts only
    const result = await query(`
      WITH transaction_totals AS (
        SELECT 
          customer_id,
          SUM(CASE WHEN transaction_type = 'debit' THEN base_amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN transaction_type = 'credit' THEN base_amount ELSE 0 END) as total_credits
        FROM transactions 
        WHERE customer_id = $1
        GROUP BY customer_id
      )
      SELECT 
        COALESCE(total_debits, 0) - COALESCE(total_credits, 0) as pending_amount
      FROM transaction_totals
    `, [customer_id]);

    const pendingAmount = Number(result.rows[0]?.pending_amount || 0);

    // Check if account exists for this customer
    const accountCheck = await query(`
      SELECT id FROM accounts WHERE customer_id = $1
    `, [customer_id]);

    if (accountCheck.rows.length === 0) {
      // Create account if it doesn't exist
      await query(`
        INSERT INTO accounts (customer_id, credit_allowed, pending_amount)
        VALUES ($1, true, $2)
      `, [customer_id, pendingAmount]);
    } else {
      // Update existing account
      await query(`
        UPDATE accounts 
        SET pending_amount = $2 
        WHERE customer_id = $1
      `, [customer_id, pendingAmount]);
    }

    return NextResponse.json({ 
      success: true, 
      customer_id, 
      pending_amount: pendingAmount 
    });

  } catch (e: any) {
    console.error('Error calculating pending amount:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Calculate pending amounts for all customers
export async function GET() {
  try {
    // Calculate pending amounts for all customers
    // Tax is always paid immediately, so pending amount is based on base amounts only
    const result = await query(`
      WITH transaction_totals AS (
        SELECT 
          customer_id,
          SUM(CASE WHEN transaction_type = 'debit' THEN base_amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN transaction_type = 'credit' THEN base_amount ELSE 0 END) as total_credits
        FROM transactions 
        GROUP BY customer_id
      )
      UPDATE accounts 
      SET pending_amount = COALESCE(tt.total_debits, 0) - COALESCE(tt.total_credits, 0)
      FROM transaction_totals tt
      WHERE accounts.customer_id = tt.customer_id
      RETURNING accounts.customer_id, accounts.pending_amount
    `);

    return NextResponse.json({ 
      success: true, 
      updated_customers: result.rows.length,
      results: result.rows
    });

  } catch (e: any) {
    console.error('Error calculating pending amounts for all customers:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
