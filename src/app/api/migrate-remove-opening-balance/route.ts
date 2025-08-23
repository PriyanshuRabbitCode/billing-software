import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    console.log('Running migration to remove opening_balance column...');
    
    // Remove opening_balance column from accounts table
    try {
      await query(`ALTER TABLE accounts DROP COLUMN IF EXISTS opening_balance`);
      console.log('Removed opening_balance column from accounts table');
    } catch (e) {
      console.log('Opening balance column removal failed or already removed:', e);
    }
    
    return NextResponse.json({
      success: true,
      message: "Opening balance column removal completed successfully"
    });
    
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to remove opening balance column' 
    }, { status: 500 });
  }
}
