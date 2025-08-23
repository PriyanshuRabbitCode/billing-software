import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await query('ALTER TABLE public.card_details ADD COLUMN IF NOT EXISTS due_date DATE;');
    return NextResponse.json({ message: 'Migration successful' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
