import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Add base_amount column
    await query(`ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2);`);
    
    // Update existing transactions to set base_amount using deposit_amount or withdraw_amount
    await query(`
      UPDATE public.transactions 
      SET base_amount = COALESCE(deposit_amount, withdraw_amount, 0) 
      WHERE base_amount IS NULL
    `);
    
    return NextResponse.json({ success: true, message: "Base amount column added successfully" });
  } catch (e: any) {
    console.error('Error adding base_amount column:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
