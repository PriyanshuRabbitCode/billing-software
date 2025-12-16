import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const customerId = searchParams.get('customer_id');

    let baseQuery = `
      SELECT a.*, c.full_name as customer_name
      FROM accounts a
      LEFT JOIN customers c ON a.customer_id = c.id
    `;
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (customerId) {
      baseQuery += ` WHERE a.customer_id = $${paramIndex}`;
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    baseQuery += ` ORDER BY a.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const { rows } = await query(baseQuery, queryParams);

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Accounts GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, credit_allowed, credit_limit, price_category, remark } = body;

    // Validate required fields
    if (!customer_id) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Check if customer exists
    const { rows: existingCustomers } = await query(
      'SELECT id FROM customers WHERE id = $1',
      [customer_id]
    );
    if (existingCustomers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if account already exists for this customer
    const { rows: existingAccount } = await query(
      'SELECT id FROM accounts WHERE customer_id = $1',
      [customer_id]
    );
    if (existingAccount.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Account already exists for this customer' },
        { status: 400 }
      );
    }

    // Insert new account
    const insertQuery = `
      INSERT INTO accounts (customer_id, credit_allowed, credit_limit, price_category, remark)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [
      customer_id, 
      credit_allowed || false, 
      credit_limit || null, 
      price_category || null, 
      remark || null
    ]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Accounts POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
