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

    // Build update query - only update fields that have actually changed
    const allowedFields = [
      'bank_name', 'card_type', 'card_name', 'card_number', 'due_date',
      'enable_defaults', 'default_pos_type', 'custom_pos_type', 'default_tax_rate', 'default_mdr_rate', 'due_day'
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Allowed POS types per DB constraint
    const allowedPosTypes = ['MP', 'PH', 'MOS'];

    // Track if due_day is being updated and its normalized value
    let dueDayNew: number | null | undefined = undefined;
    let dueDateExplicitlyUpdated = false;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        let processedValue: any = value;

        // Normalize empty strings to NULL for numeric/integer fields
        if ((key === 'default_tax_rate' || key === 'default_mdr_rate' || key === 'due_day') && processedValue === '') {
          processedValue = null;
        }
        // Coerce string numbers to actual numbers for numeric fields
        if ((key === 'default_tax_rate' || key === 'default_mdr_rate') && typeof processedValue === 'string' && processedValue !== '') {
          const n = Number(processedValue);
          if (isNaN(n) || n < 0) {
            return NextResponse.json(
              { success: false, error: `${key} must be a non-negative number` },
              { status: 400 }
            );
          }
          processedValue = n;
        }
        // Coerce due_day to integer
        if (key === 'due_day') {
          if (typeof processedValue === 'string' && processedValue !== '') {
            const n = parseInt(processedValue, 10);
            if (isNaN(n) || n <= 0 || n > 31) {
              return NextResponse.json(
                { success: false, error: 'due_day must be an integer between 1 and 31, or empty to clear' },
                { status: 400 }
              );
            }
            processedValue = n;
          }
          if (processedValue !== null && typeof processedValue === 'number') {
            dueDayNew = processedValue;
          } else {
            dueDayNew = null;
          }
        }

        // Clean card number by removing spaces if it's being updated
        if (key === 'card_number' && processedValue && typeof processedValue === 'string' && processedValue !== existingCards[0][key]) {
          processedValue = processedValue.replace(/\s/g, '');
        }

        // Map UI "Custom" default_pos_type to NULL; validate allowed values
        if (key === 'default_pos_type') {
          if (processedValue === '' || processedValue === 'Custom') {
            processedValue = null;
          } else if (processedValue && !allowedPosTypes.includes(processedValue)) {
            return NextResponse.json(
              { success: false, error: `Invalid default_pos_type. Allowed values: ${allowedPosTypes.join(', ')}` },
              { status: 400 }
            );
          }
        }

        // Normalize empty custom_pos_type to NULL
        if (key === 'custom_pos_type' && processedValue === '') {
          processedValue = null;
        }

        if (key === 'due_date') {
          dueDateExplicitlyUpdated = true;
        }
        
        // Only update if the value has actually changed
        if (processedValue !== existingCards[0][key]) {
          updates.push(`${key} = $${paramIndex}`);
          values.push(processedValue);
          paramIndex++;
        }
      }
    }

    // If due_day is updated and due_date is NOT explicitly provided, compute upcoming due_date and include update
    if (dueDayNew !== undefined && !dueDateExplicitlyUpdated) {
      // Helper: compute upcoming due date from dueDay
      const computeUpcomingDueDate = (dueDay: number | null): string | null => {
        if (dueDay === null) return null;
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const year = today.getFullYear();
        const month = today.getMonth();
        const lastDayCurrentMonth = new Date(year, month + 1, 0).getDate();
        const dayCurrent = Math.min(dueDay, lastDayCurrentMonth);
        const candidate = new Date(year, month, dayCurrent);
        candidate.setHours(0, 0, 0, 0);
        if (candidate >= startOfToday) {
          const yyyy = candidate.getFullYear();
          const mm = String(candidate.getMonth() + 1).padStart(2, '0');
          const dd = String(candidate.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
        const nextYear = month === 11 ? year + 1 : year;
        const nextMonthIndex = (month + 1) % 12;
        const lastDayNextMonth = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
        const dayNext = Math.min(dueDay, lastDayNextMonth);
        const nextCandidate = new Date(nextYear, nextMonthIndex, dayNext);
        nextCandidate.setHours(0, 0, 0, 0);
        const yyyy2 = nextCandidate.getFullYear();
        const mm2 = String(nextCandidate.getMonth() + 1).padStart(2, '0');
        const dd2 = String(nextCandidate.getDate()).padStart(2, '0');
        return `${yyyy2}-${mm2}-${dd2}`;
      };

      const computedDueDate = computeUpcomingDueDate(dueDayNew ?? null);
      if (computedDueDate !== existingCards[0]['due_date']) {
        updates.push(`due_date = $${paramIndex}`);
        values.push(computedDueDate);
        paramIndex++;
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
