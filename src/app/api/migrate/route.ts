import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    console.log('Running database migration...');
    
    // Check if transactions table has the new columns
    const checkColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND table_schema = 'public'
    `);
    
    const existingColumns = checkColumns.rows.map((row: any) => row.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Add missing columns if they don't exist
    const requiredColumns = [
      'deposit_amount',
      'withdraw_amount', 
      'payable_amount',
      'tax_rate',
      'tax_amount',
      'mdr_amount',
      'mdr_charge_amount',
      'profit_amount',
      'add_tax_to_withdraw',
      'pending_amount',
      'status',
      'created_at'
    ];
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('Adding missing columns:', missingColumns);
      
      for (const column of missingColumns) {
        let columnType = 'DECIMAL(10,2) DEFAULT 0.00';
        
        if (column === 'add_tax_to_withdraw') {
          columnType = 'BOOLEAN DEFAULT FALSE';
        } else if (column === 'status') {
          columnType = "VARCHAR(20) DEFAULT 'Pending'";
        } else if (column === 'created_at') {
          columnType = 'TIMESTAMPTZ DEFAULT NOW()';
        } else if (column === 'tax_rate' || column === 'mdr_amount') {
          columnType = 'DECIMAL(5,2) DEFAULT 0.00';
        }
        
        await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ${column} ${columnType}`);
      }
    }
    
    // Check if card_details table has card_number column
    const checkCardColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'card_details' 
      AND table_schema = 'public'
    `);
    
    const existingCardColumns = checkCardColumns.rows.map((row: any) => row.column_name);
    
    if (!existingCardColumns.includes('card_number')) {
      console.log('Adding card_number column to card_details table');
      await query(`ALTER TABLE card_details ADD COLUMN IF NOT EXISTS card_number VARCHAR(20)`);
      await query(`ALTER TABLE card_details ADD CONSTRAINT IF NOT EXISTS card_details_card_number_unique UNIQUE (card_number)`);
    }
    
    if (!existingCardColumns.includes('due_date')) {
      console.log('Adding due_date column to card_details table');
      await query(`ALTER TABLE card_details ADD COLUMN IF NOT EXISTS due_date DATE`);
    }
    
    // Add foreign key constraint if it doesn't exist
    try {
      await query(`
        ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_card_number_fkey 
        FOREIGN KEY (card_number) REFERENCES card_details(card_number)
      `);
    } catch (e) {
      console.log('Foreign key constraint already exists or cannot be created');
    }
    
    // Add check constraints
    try {
      await query(`
        ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_status_check 
        CHECK (status IN ('Pending', 'PAID', 'Overpaid'))
      `);
    } catch (e) {
      console.log('Status check constraint already exists or cannot be created');
    }
    
    try {
      await query(`
        ALTER TABLE transactions ADD CONSTRAINT IF NOT EXISTS transactions_pos_type_check 
        CHECK (pos_type IN ('MP', 'PH', 'MOS'))
      `);
    } catch (e) {
      console.log('POS type check constraint already exists or cannot be created');
    }
    
    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_card_number ON transactions(card_number)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_card_details_customer_id ON card_details(customer_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_card_details_card_number ON card_details(card_number)`);
    
    console.log('Migration completed successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database migration completed',
      missingColumnsAdded: missingColumns
    });
    
  } catch (e: any) {
    console.error('Migration error:', e);
    return NextResponse.json({ 
      error: e.message 
    }, { status: 500 });
  }
}
