import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Create card_pending_amounts table
    await query(`
      CREATE TABLE IF NOT EXISTS public.card_pending_amounts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
        card_number VARCHAR(20) NOT NULL,
        card_name VARCHAR(100),
        pending_amount DECIMAL(10,2) DEFAULT 0.00,
        received_amount DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(customer_id, card_number)
      );
    `);

    // Add received_amount column if it doesn't exist (for existing tables)
    await query(`
      ALTER TABLE public.card_pending_amounts ADD COLUMN IF NOT EXISTS received_amount DECIMAL(10,2) DEFAULT 0.00;
    `);

    // Create indexes for better performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_card_pending_amounts_card_number ON public.card_pending_amounts(card_number);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_card_pending_amounts_customer_id ON public.card_pending_amounts(customer_id);
    `);

    return NextResponse.json({ 
      success: true, 
      message: "Card pending amounts table created successfully" 
    });
  } catch (e: any) {
    console.error('Error creating card pending amounts table:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
