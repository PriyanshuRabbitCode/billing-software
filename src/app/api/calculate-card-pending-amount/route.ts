import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

// Calculate pending amount for a specific card
export async function POST(req: NextRequest) {
  try {
    const { card_number } = await req.json();
    
    if (!card_number) {
      return NextResponse.json({ error: 'Card number is required' }, { status: 400 });
    }

    // Calculate pending amount and received amount based on transaction history for this specific card
    const result = await query(`
      WITH transaction_totals AS (
        SELECT 
          customer_id,
          card_number,
          SUM(CASE WHEN transaction_type = 'debit' THEN base_amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN transaction_type = 'credit' THEN base_amount ELSE 0 END) as total_credits
        FROM transactions 
        WHERE card_number = $1
        GROUP BY customer_id, card_number
      )
      SELECT 
        customer_id,
        card_number,
        COALESCE(total_debits, 0) - COALESCE(total_credits, 0) as pending_amount,
        COALESCE(total_credits, 0) as received_amount
      FROM transaction_totals
    `, [card_number]);

    if (result.rows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        card_number,
        pending_amount: 0,
        message: "No transactions found for this card"
      });
    }

    const { customer_id, pending_amount, received_amount } = result.rows[0];

    // Get card name from card_details table
    const cardDetails = await query(`
      SELECT card_name FROM card_details WHERE card_number = $1 AND customer_id = $2
    `, [card_number, customer_id]);

    const cardName = cardDetails.rows[0]?.card_name || '';

    // Check if card pending amount record exists
    const existingRecord = await query(`
      SELECT id FROM card_pending_amounts WHERE card_number = $1 AND customer_id = $2
    `, [card_number, customer_id]);

    if (existingRecord.rows.length === 0) {
      // Create new record
      await query(`
        INSERT INTO card_pending_amounts (customer_id, card_number, card_name, pending_amount, received_amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [customer_id, card_number, cardName, pending_amount, received_amount]);
    } else {
      // Update existing record
      await query(`
        UPDATE card_pending_amounts 
        SET pending_amount = $3, received_amount = $4, card_name = $5, updated_at = NOW()
        WHERE card_number = $1 AND customer_id = $2
      `, [card_number, customer_id, pending_amount, received_amount, cardName]);
    }

    return NextResponse.json({ 
      success: true, 
      card_number,
      customer_id,
      card_name: cardName,
      pending_amount: Number(pending_amount),
      received_amount: Number(received_amount)
    });

  } catch (e: any) {
    console.error('Error calculating card pending amount:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Calculate pending amounts for all cards
export async function GET() {
  try {
    // Calculate pending amounts for all cards
    const result = await query(`
      WITH transaction_totals AS (
        SELECT 
          customer_id,
          card_number,
          SUM(CASE WHEN transaction_type = 'debit' THEN base_amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN transaction_type = 'credit' THEN base_amount ELSE 0 END) as total_credits
        FROM transactions 
        WHERE card_number IS NOT NULL AND card_number != ''
        GROUP BY customer_id, card_number
      ),
      card_names AS (
        SELECT DISTINCT cd.customer_id, cd.card_number, cd.card_name
        FROM card_details cd
        WHERE cd.card_number IS NOT NULL AND cd.card_number != ''
      )
      INSERT INTO card_pending_amounts (customer_id, card_number, card_name, pending_amount, received_amount)
      SELECT 
        tt.customer_id,
        tt.card_number,
        COALESCE(cn.card_name, 'Unknown Card') as card_name,
        COALESCE(tt.total_debits, 0) - COALESCE(tt.total_credits, 0) as pending_amount,
        COALESCE(tt.total_credits, 0) as received_amount
      FROM transaction_totals tt
      LEFT JOIN card_names cn ON cn.customer_id = tt.customer_id AND cn.card_number = tt.card_number
      ON CONFLICT (customer_id, card_number) 
      DO UPDATE SET 
        pending_amount = EXCLUDED.pending_amount,
        received_amount = EXCLUDED.received_amount,
        card_name = EXCLUDED.card_name,
        updated_at = NOW()
      RETURNING customer_id, card_number, card_name, pending_amount, received_amount
    `);

    return NextResponse.json({ 
      success: true, 
      updated_cards: result.rows.length,
      results: result.rows
    });

  } catch (e: any) {
    console.error('Error calculating pending amounts for all cards:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
