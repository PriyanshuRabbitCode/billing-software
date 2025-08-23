import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/postgres';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const client = await getPool().connect();
    
    try {
      // Read the migration file
      const migrationPath = path.join(process.cwd(), 'migrations', 'make_customer_fields_mandatory.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log('Running migration: make_customer_fields_mandatory.sql');
      
      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing:', statement);
          await client.query(statement);
        }
      }
      
      console.log('Migration completed successfully');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Migration completed successfully' 
      });
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
