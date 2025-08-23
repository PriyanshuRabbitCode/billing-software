import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Test database connection
    const testQuery = await query('SELECT NOW() as current_time');
    console.log('Database connection test:', testQuery.rows[0]);
    
    // Check transactions table structure
    const transactionsColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    // Check card_details table structure
    const cardDetailsColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'card_details' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    // Check if there are any existing transactions
    const transactionCount = await query('SELECT COUNT(*) as count FROM transactions');
    
    // Check if there are any existing card_details
    const cardDetailsCount = await query('SELECT COUNT(*) as count FROM card_details');
    
    return NextResponse.json({
      success: true,
      databaseConnection: 'OK',
      currentTime: testQuery.rows[0].current_time,
      transactionsTable: {
        columns: transactionsColumns.rows,
        recordCount: transactionCount.rows[0].count
      },
      cardDetailsTable: {
        columns: cardDetailsColumns.rows,
        recordCount: cardDetailsCount.rows[0].count
      }
    });
    
  } catch (e: any) {
    console.error('Database test error:', e);
    return NextResponse.json({ 
      error: e.message,
      stack: e.stack
    }, { status: 500 });
  }
}
