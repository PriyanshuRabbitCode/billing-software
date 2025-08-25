import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('Running card_details migration...');
    
    // Check if the table exists first
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'card_details'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('card_details table does not exist, creating it...');
      await query(`
        CREATE TABLE IF NOT EXISTS card_details (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER REFERENCES customers(id),
          bank_name VARCHAR(100),
          card_type VARCHAR(50),
          card_name VARCHAR(100),
          card_number VARCHAR(20) UNIQUE,
          due_date DATE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } else {
      console.log('card_details table exists, adding due_date column...');
      await query('ALTER TABLE public.card_details ADD COLUMN IF NOT EXISTS due_date DATE;');
    }
    
    console.log('Card details migration completed successfully');
    return NextResponse.json({ message: 'Migration successful' });
  } catch (e: unknown) {
    console.error('Card details migration error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
