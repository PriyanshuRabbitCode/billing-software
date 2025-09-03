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
      SELECT i.*, c.full_name as customer_name
      FROM identity_documents i
      LEFT JOIN customers c ON i.customer_id = c.id
    `;
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (customerId) {
      baseQuery += ` WHERE i.customer_id = $${paramIndex}`;
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    baseQuery += ` ORDER BY i.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const { rows } = await query(baseQuery, queryParams);

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Identity documents GET error:', error);
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
    const { customer_id, document_type, document_number, document_image } = body;

    // Validate required fields
    if (!customer_id || !document_type || !document_number) {
      return NextResponse.json(
        { success: false, error: 'Customer ID, document type, and document number are required' },
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

    // Insert new identity document
    const insertQuery = `
      INSERT INTO identity_documents (customer_id, document_type, document_number, document_image)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [customer_id, document_type, document_number, document_image]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Identity documents POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
