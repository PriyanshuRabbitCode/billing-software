import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";
import { schemas } from "@/lib/tableSchemas";

export const runtime = 'nodejs';

const allowedTables = new Set(Object.values(schemas).map((s) => s.table));

function getTableSchema(table: string) {
  const entry = Object.values(schemas).find((s) => s.table === table);
  return entry ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!allowedTables.has(table)) {
    return NextResponse.json({ error: "Table not allowed" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customer_id');
    
    let queryString = `SELECT * FROM ${table}`;
    let queryParams: any[] = [];
    
    // Special handling for customers table to include card due date
    if (table === 'customers') {
      queryString = `
        SELECT c.*, 
               (SELECT MIN(cd.due_date) 
                FROM card_details cd 
                WHERE cd.customer_id = c.id) as card_due_date
        FROM customers c
      `;
    }
    
    if (customerId) {
      if (table === 'customers') {
        queryString += ` WHERE c.id = $1`;
      } else {
        queryString += ` WHERE customer_id = $1`;
      }
      queryParams.push(customerId);
    }
    
    if (table === 'customers') {
      queryString += ` ORDER BY c.id DESC LIMIT 1000`;
    } else {
      queryString += ` ORDER BY id DESC LIMIT 1000`;
    }
    
    const { rows } = await query(queryString, queryParams);
    return NextResponse.json(rows ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!allowedTables.has(table)) {
    return NextResponse.json({ error: "Table not allowed" }, { status: 400 });
  }
  const schema = getTableSchema(table);
  if (!schema) return NextResponse.json({ error: "Schema not found" }, { status: 400 });

  const body = await req.json();
  const allowedFields = new Set(schema.fields.map((f) => f.name));
  const entries = Object.entries(body).filter(([k]) => allowedFields.has(k));
  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const columns = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);

  // Validate required fields with conditional logic for transactions and accounts
  const requiredFields = schema.fields.filter(f => f.required);
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const value = body[field.name];
    
    // Special handling for transactions table
    if (table === 'transactions') {
      // For transactions, customer_id is always required
      if (field.name === 'customer_id') {
        if (value === undefined || value === null || value === "") {
          missingFields.push(field.label || field.name);
        }
      }
      // For withdraw transactions, pos_type and tax_rate are required
      else if ((field.name === 'pos_type' || field.name === 'tax_rate') && body.withdraw_amount && parseFloat(body.withdraw_amount) > 0) {
        if (value === undefined || value === null || value === "") {
          missingFields.push(field.label || field.name);
        }
      }
      // Skip validation for other fields in transactions as they are calculated or optional
    }
    // Special handling for accounts table
    else if (table === 'accounts') {
      // Credit limit is only required if credit_allowed is explicitly set to true
      if (field.name === 'credit_limit' && body.credit_allowed === true) {
        // Only validate credit_limit if credit_allowed is explicitly true
        if (value === undefined || value === null || value === "") {
          missingFields.push(field.label || field.name);
        }
      } else if (field.name === 'credit_limit') {
        // Skip validation for credit_limit if credit_allowed is not true
        continue;
      } else {
        // For other fields, use standard validation
        if (value === undefined || value === null || value === "") {
          missingFields.push(field.label || field.name);
        }
      }
    } else {
      // For other tables, use standard validation
      if (value === undefined || value === null || value === "") {
        missingFields.push(field.label || field.name);
      }
    }
  }
  
  if (missingFields.length > 0) {
    return NextResponse.json({ 
      error: `Required fields missing: ${missingFields.join(", ")}` 
    }, { status: 400 });
  }

  // Special handling for transactions table
  let finalColumns = columns;
  let finalValues = values;
  
  if (table === 'transactions') {
    // Check if pending_amount and status are already provided in the request
    const hasPendingAmount = body.pending_amount !== undefined;
    const hasStatus = body.status !== undefined;
    
    // Only calculate if not already provided
    if (!hasPendingAmount || !hasStatus) {
      const deposit = parseFloat(body.deposit_amount || 0);
      const withdraw = parseFloat(body.withdraw_amount || 0);
      const taxAmount = parseFloat(body.tax_amount || 0);
      const addTaxToWithdraw = body.add_tax_to_withdraw || false;
      
      let pending = 0;
      if (addTaxToWithdraw) {
        // If checkbox is checked: Tax amount is added to Payable Amount
        // Pending amount = Deposit Amount - Withdraw Amount
        pending = deposit - withdraw;
      } else {
        // If checkbox is not checked: Tax amount is added to Pending Amount
        // Pending amount = (Deposit Amount - Withdraw Amount) + Tax Amount
        pending = (deposit - withdraw) + taxAmount;
      }
      
      // Determine status
      let status = "Pending";
      if (pending > 0) {
        status = "Pending";
      } else if (pending < 0) {
        status = "Overpaid";
      } else {
        status = "PAID";
      }
      
      // Add calculated fields only if not already provided
      if (!hasPendingAmount) {
        finalColumns.push('pending_amount');
        finalValues.push(pending);
      }
      if (!hasStatus) {
        finalColumns.push('status');
        finalValues.push(status);
      }
    }
  }
  
  const placeholders = finalValues.map((_, i) => `$${i + 1}`);

  try {
    console.log('Inserting into table:', table);
    console.log('Columns:', finalColumns);
    console.log('Values:', finalValues);
    
    const { rows } = await query(
      `INSERT INTO ${table} (${finalColumns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      finalValues
    );
    
    // Transaction saved successfully
    console.log('Transaction saved:', rows[0]);
    
    return NextResponse.json(rows[0] ?? null, { status: 201 });
  } catch (e: any) {
    console.error('Database error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}



