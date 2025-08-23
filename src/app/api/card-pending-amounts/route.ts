import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customer_id');

    let queryString = `
      SELECT 
        cd.card_number,
        cd.card_name,
        c.full_name as customer_name,
        COALESCE(SUM(CASE WHEN t.deposit_amount > 0 THEN t.deposit_amount ELSE 0 END), 0) as received_amount,
        COALESCE(SUM(CASE 
          WHEN t.withdraw_amount > 0 THEN 
            CASE 
              WHEN t.add_tax_to_withdraw = true THEN t.deposit_amount - t.withdraw_amount
              ELSE (t.deposit_amount - t.withdraw_amount) + t.tax_amount
            END
          ELSE 0 
        END), 0) - COALESCE(SUM(CASE 
          WHEN t.withdraw_amount = 0 AND t.deposit_amount > 0 AND t.pos_type IS NULL THEN t.deposit_amount
          ELSE 0 
        END), 0) as pending_amount
      FROM card_details cd
      LEFT JOIN customers c ON cd.customer_id = c.id
      LEFT JOIN transactions t ON cd.card_number = t.card_number
    `;

    const queryParams: any[] = [];
    
    if (customerId) {
      queryString += ` WHERE cd.customer_id = $1`;
      queryParams.push(customerId);
    }

    queryString += `
      GROUP BY cd.card_number, cd.card_name, c.full_name
      HAVING (COALESCE(SUM(CASE 
        WHEN t.withdraw_amount > 0 THEN 
          CASE 
            WHEN t.add_tax_to_withdraw = true THEN t.deposit_amount - t.withdraw_amount
            ELSE (t.deposit_amount - t.withdraw_amount) + t.tax_amount
          END
        ELSE 0 
      END), 0) - COALESCE(SUM(CASE 
        WHEN t.withdraw_amount = 0 AND t.deposit_amount > 0 AND t.pos_type IS NULL THEN t.deposit_amount
        ELSE 0 
      END), 0)) > 0 OR COALESCE(SUM(CASE WHEN t.deposit_amount > 0 THEN t.deposit_amount ELSE 0 END), 0) > 0
      ORDER BY cd.card_number
    `;

    const { rows } = await query(queryString, queryParams);

    // Transform the data to match the expected format
    const transformedData = rows.map(row => ({
      cardNumber: row.card_number,
      cardName: row.card_name,
      customerName: row.customer_name,
      receivedAmount: parseFloat(row.received_amount || 0),
      pendingAmount: parseFloat(row.pending_amount || 0)
    }));

    return NextResponse.json(transformedData);

  } catch (error: any) {
    console.error('Error fetching card pending amounts:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch card pending amounts' 
    }, { status: 500 });
  }
}
