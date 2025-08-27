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

    const customerId = parseInt(id);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    // Get customer details
    const { rows: customers } = await query(
      `SELECT c.*, 
              (SELECT MIN(cd.due_date) 
               FROM card_details cd 
               WHERE cd.customer_id = c.id) as card_due_date
       FROM customers c 
       WHERE c.id = $1`,
      [customerId]
    );

    if (customers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customer = customers[0];

    // Include cards if requested
    if (include.includes('cards')) {
      const { rows: cards } = await query(
        'SELECT * FROM card_details WHERE customer_id = $1 ORDER BY id DESC',
        [customerId]
      );
      customer.cards = cards;
    }

    // Include transactions if requested
    if (include.includes('transactions')) {
      const { rows: transactions } = await query(
        'SELECT * FROM transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
        [customerId]
      );
      customer.transactions = transactions;
    }

    // Include accounts if requested
    if (include.includes('accounts')) {
      const { rows: accounts } = await query(
        'SELECT * FROM accounts WHERE customer_id = $1 ORDER BY id DESC',
        [customerId]
      );
      customer.accounts = accounts;
    }

    // Include tax details if requested
    if (include.includes('tax_details')) {
      const { rows: taxDetails } = await query(
        'SELECT * FROM customer_tax_details WHERE customer_id = $1 ORDER BY id DESC',
        [customerId]
      );
      customer.tax_details = taxDetails;
    }

    // Include identity documents if requested
    if (include.includes('identity_documents')) {
      const { rows: identityDocuments } = await query(
        'SELECT * FROM identity_documents WHERE customer_id = $1 ORDER BY id DESC',
        [customerId]
      );
      customer.identity_documents = identityDocuments;
    }

    return NextResponse.json({
      success: true,
      data: customer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Customer GET error:', error);
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
    const customerId = parseInt(id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    // Check if customer exists
    const { rows: existingCustomers } = await query(
      'SELECT * FROM customers WHERE id = $1',
      [customerId]
    );

    if (existingCustomers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Validate email uniqueness if being updated
    if (body.email_id && body.email_id !== existingCustomers[0].email_id) {
      const { rows: duplicateEmail } = await query(
        'SELECT id FROM customers WHERE email_id = $1 AND id != $2',
        [body.email_id, customerId]
      );
      if (duplicateEmail.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Validate contact number uniqueness if being updated
    if (body.contact_no && body.contact_no !== existingCustomers[0].contact_no) {
      const { rows: duplicateContact } = await query(
        'SELECT id FROM customers WHERE contact_no = $1 AND id != $2',
        [body.contact_no, customerId]
      );
      if (duplicateContact.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Contact number already exists' },
          { status: 400 }
        );
      }
    }

    // Build update query
    const allowedFields = ['full_name', 'email_id', 'contact_no', 'pan_no', 'aadhaar_no'];
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

    // Add customer ID to values
    values.push(customerId);

    const updateQuery = `
      UPDATE customers 
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
    console.error('Customer PATCH error:', error);
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
    const customerId = parseInt(id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    // Check if customer exists
    const { rows: existingCustomers } = await query(
      'SELECT * FROM customers WHERE id = $1',
      [customerId]
    );

    if (existingCustomers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Delete the customer (this will cascade to related records)
    await query('DELETE FROM customers WHERE id = $1', [customerId]);

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Customer DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
