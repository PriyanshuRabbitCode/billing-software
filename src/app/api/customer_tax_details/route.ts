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
      SELECT t.*, c.full_name as customer_name
      FROM customer_tax_details t
      LEFT JOIN customers c ON t.customer_id = c.id
    `;
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (customerId) {
      baseQuery += ` WHERE t.customer_id = $${paramIndex}`;
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    baseQuery += ` ORDER BY t.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const { rows } = await query(baseQuery, queryParams);

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Customer tax details GET error:', error);
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
    const { customer_id, pan_no, aadhaar_no } = body;

    // Validate required fields
    if (!customer_id || !pan_no) {
      return NextResponse.json(
        { success: false, error: 'Customer ID and PAN number are required' },
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

    // Check if tax details already exist for this customer
    const { rows: existingTax } = await query(
      'SELECT id FROM customer_tax_details WHERE customer_id = $1',
      [customer_id]
    );
    if (existingTax.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Tax details already exist for this customer' },
        { status: 400 }
      );
    }

    // Insert new tax details
    const insertQuery = `
      INSERT INTO customer_tax_details (customer_id, pan_no, aadhaar_no)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [customer_id, pan_no, aadhaar_no]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Customer tax details POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
