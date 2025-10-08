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
  due_day?: number;
  next_due_date?: string;
  enable_defaults?: boolean;
  default_pos_type?: string;
  default_tax_rate?: number;
  default_mdr_rate?: number;
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
    // ...
    let baseQuery = `
    SELECT 
      cd.*, 
      CASE 
        WHEN cd.due_day IS NOT NULL THEN (
          CASE 
            WHEN make_date(
              EXTRACT(YEAR FROM CURRENT_DATE)::int,
              EXTRACT(MONTH FROM CURRENT_DATE)::int,
              LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
            ) >= CURRENT_DATE
            THEN make_date(
              EXTRACT(YEAR FROM CURRENT_DATE)::int,
              EXTRACT(MONTH FROM CURRENT_DATE)::int,
              LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
            )
            ELSE make_date(
              EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
              EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
              LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
            )
          END
        )
        ELSE NULL
      END AS next_due_date
    FROM card_details cd
    `;
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
      whereConditions.push(`REPLACE(cd.card_number, ' ', '') = REPLACE($${paramIndex}, ' ', '')`);
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
        WHERE id = ANY($1::int[])
      `;
      const { rows: customers } = await query(customerQuery, [customerIds]);
      
      const customerMap = new Map(customers.map(c => [c.id, c]));
      cards.forEach(card => {
        card.customer = customerMap.get(card.customer_id);
      });
    }

    // Include pending amounts if requested
    if (include.includes('pending') && cards.length > 0) {
      const cardNumbersClean = cards.map(card => (card.card_number || '').replace(/\s/g, '')).filter(n => n);
      if (cardNumbersClean.length > 0) {
        const pendingQuery = `
          SELECT 
            REPLACE(card_number, ' ', '') AS card_number_clean,
            COALESCE(SUM(deposit_amount), 0) as total_deposits,
            COALESCE(SUM(withdraw_amount), 0) as total_withdrawals,
            GREATEST(COALESCE(SUM(pending_amount), 0), 0) as pending_amount
          FROM transactions 
          WHERE REPLACE(card_number, ' ', '') = ANY($1::text[])
          GROUP BY REPLACE(card_number, ' ', '')
        `;
        const { rows: pendingData } = await query(pendingQuery, [cardNumbersClean]);
        
        const pendingMap = new Map(pendingData.map(p => [p.card_number_clean, p]));
        cards.forEach(card => {
          const cleanNumber = (card.card_number || '').replace(/\s/g, '');
          const pending = pendingMap.get(cleanNumber);
          if (pending) {
            card.total_deposits = parseFloat(pending.total_deposits);
            card.total_withdrawals = parseFloat(pending.total_withdrawals);
            card.pending_amount = Math.max(0, parseFloat(pending.pending_amount));
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
    const { 
      customer_id, 
      bank_name, 
      card_type, 
      card_name, 
      card_number, 
      due_day,
      enable_defaults,
      default_pos_type,
      custom_pos_type,
      default_tax_rate,
      default_mdr_rate
    } = body;

    // Validate required fields
    if (!customer_id || !bank_name || !card_type || !card_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customer_id, bank_name, card_type, card_name' },
        { status: 400 }
      );
    }

    // Validate default_pos_type against DB constraint
    const allowedPosTypes = ['MP', 'PH', 'MOS'];
    let posTypeToInsert: string | null | undefined = default_pos_type;
    if (posTypeToInsert) {
      if (posTypeToInsert === 'Custom') {
        // Map UI "Custom" option to NULL for DB, use custom_pos_type for UI-only presets
        posTypeToInsert = null;
      } else if (!allowedPosTypes.includes(posTypeToInsert)) {
        return NextResponse.json(
          { success: false, error: `Invalid default_pos_type. Allowed values: ${allowedPosTypes.join(', ')}` },
          { status: 400 }
        );
      }
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
        "SELECT id FROM card_details WHERE REPLACE(card_number, ' ' , '') = $1",
        [cleanCardNumber]
      );
      if (existingCard.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Card number already exists (ignoring spaces)' },
          { status: 400 }
        );
      }
    }

    // Normalize and validate due_day if provided
    let normalizedDueDay: number | null = null;
    if (due_day !== undefined && due_day !== null && (due_day as any) !== '') {
      const n = typeof due_day === 'string' ? parseInt(due_day, 10) : Number(due_day);
      if (Number.isNaN(n) || n <= 0 || n > 31) {
        return NextResponse.json(
          { success: false, error: 'Invalid due day. Must be between 1 and 31.' },
          { status: 400 }
        );
      }
      normalizedDueDay = n;
    }

    // Helper to compute upcoming due date string (YYYY-MM-DD) from due_day
    const computeUpcomingDueDate = (dueDay: number) => {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-based
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

    // Insert new card - clean card number by removing spaces before storing
    const cleanCardNumber = card_number ? card_number.replace(/\s/g, '') : null;
    
    const insertQuery = `
      INSERT INTO card_details (
        customer_id, bank_name, card_type, card_name, card_number, due_day,
        enable_defaults, default_pos_type, custom_pos_type, default_tax_rate, default_mdr_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [
      customer_id, bank_name, card_type, card_name, cleanCardNumber, normalizedDueDay,
      enable_defaults || false, posTypeToInsert || null, custom_pos_type || null, default_tax_rate || null, default_mdr_rate || null
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
