import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await query('SELECT NOW() as current_time');
    console.log('Database connection successful:', result.rows[0]);
    
    // Test if required tables exist
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('customers', 'transactions', 'card_details', 'accounts')
      ORDER BY table_name
    `);
    
    const existingTables = tables.rows.map(row => row.table_name);
    console.log('Existing tables:', existingTables);
    
    // Check for missing tables
    const requiredTables = ['customers', 'transactions', 'card_details', 'accounts'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('Missing tables:', missingTables);
      return NextResponse.json({ 
        status: 'warning',
        message: 'Some required tables are missing',
        existingTables,
        missingTables
      });
    }
    
    return NextResponse.json({ 
      status: 'success',
      message: 'Database connection and tables are working correctly',
      currentTime: result.rows[0].current_time,
      existingTables
    });
    
  } catch (e: unknown) {
    console.error('Database test error:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    
    return NextResponse.json({ 
      status: 'error',
      message: 'Database connection failed',
      error: errorMessage
    }, { status: 500 });
  }
}
