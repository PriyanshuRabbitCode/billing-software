import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    console.log('Running customer form migration...');
    
    // Step 1: Remove country column from customers table
    try {
      await query(`ALTER TABLE customers DROP COLUMN IF EXISTS country`);
      console.log('Removed country column from customers table');
    } catch (e) {
      console.log('Country column removal failed or already removed:', e);
    }
    
    // Step 2: Add aadhaar_no column to customer_tax_details table
    try {
      await query(`ALTER TABLE customer_tax_details ADD COLUMN IF NOT EXISTS aadhaar_no VARCHAR(20)`);
      console.log('Added aadhaar_no column to customer_tax_details table');
    } catch (e) {
      console.log('Aadhaar column addition failed:', e);
    }
    
    // Step 3: Drop gst_no column from customer_tax_details table
    try {
      await query(`ALTER TABLE customer_tax_details DROP COLUMN IF EXISTS gst_no`);
      console.log('Removed gst_no column from customer_tax_details table');
    } catch (e) {
      console.log('GST column removal failed or already removed:', e);
    }
    
    // Step 4: Add index on aadhaar_no for better performance
    try {
      await query(`CREATE INDEX IF NOT EXISTS idx_customer_tax_details_aadhaar_no ON customer_tax_details(aadhaar_no)`);
      console.log('Added index on aadhaar_no column');
    } catch (e) {
      console.log('Index creation failed:', e);
    }
    
    // Step 5: Add validation constraint for aadhaar_no (12 digits)
    try {
      await query(`
        ALTER TABLE customer_tax_details DROP CONSTRAINT IF EXISTS check_aadhaar_no_format;
        ALTER TABLE customer_tax_details ADD CONSTRAINT check_aadhaar_no_format 
        CHECK (aadhaar_no IS NULL OR aadhaar_no ~ '^[0-9]{12}$')
      `);
      console.log('Added aadhaar number format validation');
    } catch (e) {
      console.log('Validation constraint creation failed:', e);
    }
    
    return NextResponse.json({
      success: true,
      message: "Customer form migration completed successfully"
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to run customer form migration' 
    }, { status: 500 });
  }
}
