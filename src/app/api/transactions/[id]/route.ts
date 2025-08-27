import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || '';

    const transactionId = parseInt(id);
    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Get transaction details
    const { rows: transactions } = await query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = transactions[0];

    // Include customer data if requested
    if (include.includes('customer')) {
      const { rows: customers } = await query(
        'SELECT id, full_name, email_id, contact_no FROM customers WHERE id = $1',
        [transaction.customer_id]
      );
      if (customers.length > 0) {
        transaction.customer = customers[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transaction GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Check if transaction exists
    const { rows: existingTransactions } = await query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (existingTransactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Build update query
    const allowedFields = [
      'card_number', 'card_name', 'deposit_amount', 'withdraw_amount',
      'payable_amount', 'add_tax_to_withdraw', 'pos_type', 'tax_rate',
      'tax_amount', 'mdr_amount', 'mdr_charge_amount', 'profit_amount',
      'pending_amount', 'status'
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add transaction ID to values
    values.push(transactionId);

    const updateQuery = `
      UPDATE transactions 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const { rows } = await query(updateQuery, values);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transaction PATCH error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Check if transaction exists
    const { rows: existingTransactions } = await query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (existingTransactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Delete the transaction
    await query('DELETE FROM transactions WHERE id = $1', [transactionId]);

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transaction DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
