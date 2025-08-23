import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Check if amount column exists before trying to alter it
    const amountCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'amount'
    `);
    
    if (amountCheck.rows.length > 0) {
      // Make amount column nullable
      await query(`ALTER TABLE public.transactions ALTER COLUMN amount DROP NOT NULL;`);
      return NextResponse.json({ success: true, message: "Amount column made nullable successfully" });
    } else {
      return NextResponse.json({ success: true, message: "Amount column does not exist, skipping migration" });
    }
  } catch (e: any) {
    console.error('Error making amount column nullable:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
