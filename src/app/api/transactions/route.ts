import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

interface TransactionWithRelations {
  id: number;
  customer_id: number;
  card_number: string;
  card_name: string;
  deposit_amount: number;
  withdraw_amount: number;
  payable_amount: number;
  add_tax_to_withdraw: boolean;
  pos_type: string;
  tax_rate: number;
  tax_amount: number;
  mdr_amount: number;
  mdr_charge_amount: number;
  profit_amount: number;
  pending_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Relational data (when include=customer)
  customer?: {
    id: number;
    full_name: string;
    email_id: string;
    contact_no: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || '';
    const transactionId = searchParams.get('id');
    const customerId = searchParams.get('customer_id');
    const cardNumber = searchParams.get('card_number');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build base query
    let baseQuery = 'SELECT t.* FROM transactions t';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE clauses
    const whereConditions: string[] = [];

    if (transactionId) {
      whereConditions.push(`t.id = $${paramIndex}`);
      queryParams.push(Number(transactionId));
      paramIndex++;
    }

    if (customerId) {
      whereConditions.push(`t.customer_id = $${paramIndex}`);
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    if (cardNumber) {
      whereConditions.push(`t.card_number = $${paramIndex}`);
      queryParams.push(cardNumber);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`t.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        t.card_name ILIKE $${paramIndex} OR 
        t.card_number ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`t.created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`t.created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Execute base query
    const { rows: transactions } = await query(baseQuery, queryParams);

    // Include customer data if requested
    if (include.includes('customer') && transactions.length > 0) {
      const customerIds = [...new Set(transactions.map(t => t.customer_id))];
      const customerQuery = `
        SELECT id, full_name, email_id, contact_no 
        FROM customers 
        WHERE id = ANY($1)
      `;
      const { rows: customers } = await query(customerQuery, [customerIds]);
      
      const customerMap = new Map(customers.map(c => [c.id, c]));
      transactions.forEach(transaction => {
        transaction.customer = customerMap.get(transaction.customer_id);
      });
    }

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
      pagination: {
        limit,
        offset,
        hasMore: transactions.length === limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_id,
      card_number,
      card_name,
      deposit_amount,
      withdraw_amount,
      payable_amount,
      add_tax_to_withdraw,
      pos_type,
      tax_rate,
      tax_amount,
      mdr_amount,
      mdr_charge_amount,
      profit_amount,
      pending_amount,
      status
    } = body;

    // Validate required fields
    if (!customer_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: customer_id' },
        { status: 400 }
      );
    }

    // Check if at least one amount is provided
    if (!deposit_amount && !withdraw_amount) {
      return NextResponse.json(
        { success: false, error: 'At least one amount (deposit or withdraw) is required' },
        { status: 400 }
      );
    }

    // Check if withdraw amount is greater than deposit amount
    const deposit = parseFloat(deposit_amount || 0);
    const withdraw = parseFloat(withdraw_amount || 0);
    if (withdraw > deposit) {
      return NextResponse.json(
        { success: false, error: 'Withdraw Amount cannot be greater than Deposit Amount' },
        { status: 400 }
      );
    }

    // Calculate pending amount and status if not provided
    let finalPendingAmount = pending_amount;
    let finalStatus = status;

    if (finalPendingAmount === undefined || finalStatus === undefined) {
      const taxAmount = parseFloat(tax_amount || 0);
      const addTax = add_tax_to_withdraw || false;
      
      let pending = 0;
      if (addTax) {
        // If checkbox is checked: Tax amount is added to Payable Amount
        // Pending amount = Deposit Amount - Withdraw Amount
        pending = deposit - withdraw;
      } else {
        // If checkbox is not checked: Tax amount is added to Pending Amount
        // Pending amount = (Deposit Amount - Withdraw Amount) + Tax Amount
        pending = (deposit - withdraw) + taxAmount;
      }
      
      // Determine status
      if (pending > 0) {
        finalStatus = "Pending";
      } else if (pending < 0) {
        finalStatus = "Overpaid";
      } else {
        finalStatus = "PAID";
      }
      
      finalPendingAmount = pending;
    }

    // Insert transaction
    const insertQuery = `
      INSERT INTO transactions (
        customer_id, card_number, card_name, deposit_amount, withdraw_amount,
        payable_amount, add_tax_to_withdraw, pos_type, tax_rate, tax_amount,
        mdr_amount, mdr_charge_amount, profit_amount, pending_amount, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    
    const { rows } = await query(insertQuery, [
      customer_id, card_number, card_name, deposit_amount, withdraw_amount,
      payable_amount, add_tax_to_withdraw, pos_type, tax_rate, tax_amount,
      mdr_amount, mdr_charge_amount, profit_amount, finalPendingAmount, finalStatus
    ]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Transactions POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
