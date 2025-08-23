import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Add tax_rate column if it doesn't exist
    await query(`ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(10,2) DEFAULT 0.00;`);
    
    // Add card_number column if it doesn't exist
    await query(`ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS card_number VARCHAR(20);`);
    
    // Check if account_id column exists before trying to alter it
    const accountIdCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'account_id'
    `);
    
    if (accountIdCheck.rows.length > 0) {
      // Make account_id nullable since we're replacing it with card_number
      await query(`ALTER TABLE public.transactions ALTER COLUMN account_id DROP NOT NULL;`);
    }
    
    return NextResponse.json({ success: true, message: "Transactions table updated successfully" });
  } catch (e: any) {
    console.error('Error updating transactions table:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
