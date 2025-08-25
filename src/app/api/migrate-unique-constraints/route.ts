import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    console.log('Running unique constraints migration...');
    
    // Add unique constraint for contact_no in customers table
    try {
      await query(`ALTER TABLE customers ADD CONSTRAINT unique_contact_no UNIQUE (contact_no)`);
      console.log('Added unique constraint for contact_no');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('Unique constraint for contact_no already exists');
      } else {
        console.log('Error adding contact_no unique constraint:', e);
      }
    }
    
    // Add unique constraint for aadhaar_no in customer_tax_details table
    try {
      await query(`ALTER TABLE customer_tax_details ADD CONSTRAINT unique_aadhaar UNIQUE (aadhaar_no)`);
      console.log('Added unique constraint for aadhaar_no');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('Unique constraint for aadhaar_no already exists');
      } else {
        console.log('Error adding aadhaar_no unique constraint:', e);
      }
    }
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Unique constraints migration completed successfully' 
      }
    );
  } catch (e: any) {
    console.error('Migration failed:', e);
    return NextResponse.json(
      { error: e.message }, 
      { status: 500 }
    );
  }
}

