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

    const cardId = parseInt(id);
    if (isNaN(cardId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid card ID' },
        { status: 400 }
      );
    }

    // Get card details
    const { rows: cards } = await query(
      'SELECT * FROM card_details WHERE id = $1',
      [cardId]
    );

    if (cards.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    const card = cards[0];

    // Include customer data if requested
    if (include.includes('customer')) {
      const { rows: customers } = await query(
        'SELECT id, full_name, email_id, contact_no FROM customers WHERE id = $1',
        [card.customer_id]
      );
      if (customers.length > 0) {
        card.customer = customers[0];
      }
    }

    // Include pending amounts if requested
    if (include.includes('pending') && card.card_number) {
      const { rows: pendingData } = await query(
        `SELECT 
          COALESCE(SUM(deposit_amount), 0) as total_deposits,
          COALESCE(SUM(withdraw_amount), 0) as total_withdrawals,
          COALESCE(SUM(pending_amount), 0) as pending_amount
        FROM transactions 
        WHERE card_number = $1`,
        [card.card_number]
      );
      
      if (pendingData.length > 0) {
        card.total_deposits = parseFloat(pendingData[0].total_deposits);
        card.total_withdrawals = parseFloat(pendingData[0].total_withdrawals);
        card.pending_amount = parseFloat(pendingData[0].pending_amount);
      }
    }

    return NextResponse.json({
      success: true,
      data: card,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Card GET error:', error);
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
    const cardId = parseInt(id);

    if (isNaN(cardId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid card ID' },
        { status: 400 }
      );
    }

    // Check if card exists
    const { rows: existingCards } = await query(
      'SELECT * FROM card_details WHERE id = $1',
      [cardId]
    );

    if (existingCards.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    // No need to validate card number during updates - it was already validated during creation
    // Card number uniqueness is enforced at the database level with UNIQUE constraint

    // Build update query - only update fields that have actually changed
    const allowedFields = [
      'bank_name', 'card_type', 'card_name', 'card_number', 'due_date',
      'enable_defaults', 'default_pos_type', 'custom_pos_type', 'default_tax_rate', 'default_mdr_rate'
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        let processedValue = value;
        
        // Clean card number by removing spaces if it's being updated
        if (key === 'card_number' && value && typeof value === 'string' && value !== existingCards[0][key]) {
          processedValue = value.replace(/\s/g, '');
        }
        
        // Only update if the value has actually changed
        if (processedValue !== existingCards[0][key]) {
          updates.push(`${key} = $${paramIndex}`);
          values.push(processedValue);
          paramIndex++;
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No changes detected. All values are the same as current values.' },
        { status: 400 }
      );
    }

    // Add card ID to values
    values.push(cardId);

    const updateQuery = `
      UPDATE card_details 
      SET ${updates.join(', ')}
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
    console.error('Card PATCH error:', error);
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
    const cardId = parseInt(id);

    if (isNaN(cardId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid card ID' },
        { status: 400 }
      );
    }

    // Check if card exists
    const { rows: existingCards } = await query(
      'SELECT * FROM card_details WHERE id = $1',
      [cardId]
    );

    if (existingCards.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    const card = existingCards[0];

    // Check if there are transactions using this card number
    if (card.card_number) {
      const { rows: relatedTransactions } = await query(
        'SELECT COUNT(*) as count FROM transactions WHERE card_number = $1',
        [card.card_number]
      );
      
      if (relatedTransactions[0].count > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Cannot delete card. There are ${relatedTransactions[0].count} transaction(s) associated with this card number. Please delete the transactions first or update them to use a different card number.` 
          },
          { status: 400 }
        );
      }
    }

    // Delete the card
    await query('DELETE FROM card_details WHERE id = $1', [cardId]);

    return NextResponse.json({
      success: true,
      message: 'Card deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Card DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
