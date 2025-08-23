import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customer_id = searchParams.get('customer_id');
    
    let sql = `
      SELECT a.*, c.full_name as customer_name
      FROM accounts a
      LEFT JOIN customers c ON c.id = a.customer_id
    `;
    
    const params: any[] = [];
    
    if (customer_id) {
      sql += ' WHERE a.customer_id = $1';
      params.push(customer_id);
    }
    
    sql += ' ORDER BY a.customer_id';
    
    const result = await query(sql, params);
    
    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('Error fetching accounts:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { customer_id, credit_allowed, credit_limit, remark } = body;
    
    if (!customer_id || credit_allowed === undefined) {
      return NextResponse.json({ error: 'Customer ID and credit allowed are required' }, { status: 400 });
    }
    
    const result = await query(`
      INSERT INTO accounts (customer_id, credit_allowed, credit_limit, remark, pending_amount)
      VALUES ($1, $2, $3, $4, 0)
      RETURNING *
    `, [customer_id, credit_allowed, credit_limit || null, remark || null]);
    
    return NextResponse.json(result.rows[0]);
  } catch (e: any) {
    console.error('Error creating account:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
