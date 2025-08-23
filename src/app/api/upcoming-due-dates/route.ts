import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT 
        cd.due_date,
        cd.card_number,
        cd.card_name,
        c.full_name as customer_name
      FROM card_details cd
      JOIN customers c ON c.id = cd.customer_id
      WHERE cd.due_date >= CURRENT_DATE
      ORDER BY cd.due_date ASC
      LIMIT 5`
    );

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('Error fetching upcoming due dates:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
