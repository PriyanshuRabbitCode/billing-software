import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    console.log('Running migration to fix Aadhaar constraint and remove GST type...');
    
    // Remove the problematic Aadhaar constraint
    try {
      await query(`ALTER TABLE customer_tax_details DROP CONSTRAINT IF EXISTS check_aadhaar_no_format`);
      console.log('Removed existing Aadhaar constraint');
    } catch (e) {
      console.log('Aadhaar constraint removal failed or already removed:', e);
    }
    
    // Add a more flexible Aadhaar constraint (allow empty/null values)
    try {
      await query(`
        ALTER TABLE customer_tax_details ADD CONSTRAINT check_aadhaar_no_format 
        CHECK (aadhaar_no IS NULL OR aadhaar_no = '' OR aadhaar_no ~ '^[0-9]{12}$')
      `);
      console.log('Added flexible Aadhaar constraint');
    } catch (e) {
      console.log('Aadhaar constraint creation failed:', e);
    }
    
    // Remove gst_type column from customer_tax_details table
    try {
      await query(`ALTER TABLE customer_tax_details DROP COLUMN IF EXISTS gst_type`);
      console.log('Removed gst_type column from customer_tax_details table');
    } catch (e) {
      console.log('GST type column removal failed or already removed:', e);
    }
    
    return NextResponse.json({
      success: true,
      message: "Aadhaar constraint fix and GST type removal completed successfully"
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fix Aadhaar constraint and remove GST type' 
    }, { status: 500 });
  }
}
