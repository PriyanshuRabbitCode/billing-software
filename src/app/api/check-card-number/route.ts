import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { card_number } = body;

    if (!card_number) {
      return NextResponse.json({ error: "Card number is required" }, { status: 400 });
    }

    // Remove any spaces from the card number
    const cleanCardNumber = card_number.replace(/\s+/g, '');

    // Check if the card number is valid (16 digits)
    if (!/^\d{16}$/.test(cleanCardNumber)) {
      return NextResponse.json({ error: "Card number must be exactly 16 digits" }, { status: 400 });
    }

    // Check if the card number already exists
    const { rows } = await query(
      'SELECT id FROM card_details WHERE REPLACE(card_number, \' \', \'\') = $1',
      [cleanCardNumber]
    );

    return NextResponse.json({
      exists: rows.length > 0,
      message: rows.length > 0 ? "Card number already exists" : "Card number is available"
    });
  } catch (e: any) {
    console.error('Error checking card number:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
