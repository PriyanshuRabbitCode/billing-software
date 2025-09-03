const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use the same database configuration as the application
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  try {
    console.log('Running migration: add_updated_at_to_customers.sql');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_updated_at_to_customers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    console.log('Migration completed successfully!');
    
    // Test if the column was added
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'updated_at'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ updated_at column added successfully to customers table');
    } else {
      console.log('❌ updated_at column was not added');
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    
    // If the column already exists, it's OK
    if (error.message.includes('already exists')) {
      console.log('✅ updated_at column already exists');
    }
  } finally {
    await pool.end();
  }
}

runMigration();
