import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

interface CardWithRelations {
  id: number;
  customer_id: number;
  bank_name: string;
  card_type: string;
  card_name: string;
  card_number: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  // Relational data (when include=customer)
  customer?: {
    id: number;
    full_name: string;
    email_id: string;
    contact_no: string;
  };
  // Calculated fields (when include=pending)
  pending_amount?: number;
  total_deposits?: number;
  total_withdrawals?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || '';
    const cardId = searchParams.get('id');
    const customerId = searchParams.get('customer_id');
    const cardNumber = searchParams.get('card_number');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Build base query
    let baseQuery = 'SELECT cd.* FROM card_details cd';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE clauses
    const whereConditions: string[] = [];

    if (cardId) {
      whereConditions.push(`cd.id = $${paramIndex}`);
      queryParams.push(Number(cardId));
      paramIndex++;
    }

    if (customerId) {
      whereConditions.push(`cd.customer_id = $${paramIndex}`);
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    if (cardNumber) {
      whereConditions.push(`cd.card_number = $${paramIndex}`);
      queryParams.push(cardNumber);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        cd.card_name ILIKE $${paramIndex} OR 
        cd.bank_name ILIKE $${paramIndex} OR
        cd.card_number ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY cd.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Execute base query
    const { rows: cards } = await query(baseQuery, queryParams);

    // Include customer data if requested
    if (include.includes('customer') && cards.length > 0) {
      const customerIds = [...new Set(cards.map(card => card.customer_id))];
      const customerQuery = `
        SELECT id, full_name, email_id, contact_no 
        FROM customers 
        WHERE id = ANY($1)
      `;
      const { rows: customers } = await query(customerQuery, [customerIds]);
      
      const customerMap = new Map(customers.map(c => [c.id, c]));
      cards.forEach(card => {
        card.customer = customerMap.get(card.customer_id);
      });
    }

    // Include pending amounts if requested
    if (include.includes('pending') && cards.length > 0) {
      const cardNumbers = cards.map(card => card.card_number).filter(Boolean);
      if (cardNumbers.length > 0) {
        const pendingQuery = `
          SELECT 
            card_number,
            COALESCE(SUM(deposit_amount), 0) as total_deposits,
            COALESCE(SUM(withdraw_amount), 0) as total_withdrawals,
            COALESCE(SUM(pending_amount), 0) as pending_amount
          FROM transactions 
          WHERE card_number = ANY($1)
          GROUP BY card_number
        `;
        const { rows: pendingData } = await query(pendingQuery, [cardNumbers]);
        
        const pendingMap = new Map(pendingData.map(p => [p.card_number, p]));
        cards.forEach(card => {
          const pending = pendingMap.get(card.card_number);
          if (pending) {
            card.total_deposits = parseFloat(pending.total_deposits);
            card.total_withdrawals = parseFloat(pending.total_withdrawals);
            card.pending_amount = parseFloat(pending.pending_amount);
          } else {
            card.total_deposits = 0;
            card.total_withdrawals = 0;
            card.pending_amount = 0;
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: cards,
      count: cards.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cards API error:', error);
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
    const { customer_id, bank_name, card_type, card_name, card_number, due_date } = body;

    // Validate required fields
    if (!customer_id || !bank_name || !card_type || !card_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customer_id, bank_name, card_type, card_name' },
        { status: 400 }
      );
    }

    // Validate card number format if provided
    if (card_number) {
      // Clean the card number by removing spaces for validation
      const cleanCardNumber = card_number.replace(/\s/g, '');
      
      // Validate exactly 16 digits
      if (!/^\d{16}$/.test(cleanCardNumber)) {
        return NextResponse.json(
          { success: false, error: 'Card number must be exactly 16 digits' },
          { status: 400 }
        );
      }
      
      // Check if card number already exists
      const existingCard = await query(
        'SELECT id FROM card_details WHERE REPLACE(card_number, \' \', \'\') = $1',
        [cleanCardNumber]
      );
      if (existingCard.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Card number already exists (ignoring spaces)' },
          { status: 400 }
        );
      }
    }

    // Insert new card - clean card number by removing spaces before storing
    const cleanCardNumber = card_number ? card_number.replace(/\s/g, '') : null;
    
    const insertQuery = `
      INSERT INTO card_details (customer_id, bank_name, card_type, card_name, card_number, due_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [
      customer_id, bank_name, card_type, card_name, cleanCardNumber, due_date
    ]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Cards POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
