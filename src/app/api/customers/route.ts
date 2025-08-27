import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

interface CustomerWithRelations {
  id: number;
  full_name: string;
  email_id: string;
  contact_no: string;
  pan_no: string;
  aadhaar_no: string;
  created_at: string;
  updated_at: string;
  card_due_date?: string;
  // Relational data (when include=cards)
  cards?: any[];
  // Relational data (when include=transactions)
  transactions?: any[];
  // Relational data (when include=accounts)
  accounts?: any[];
  // Relational data (when include=tax_details)
  tax_details?: any[];
  // Relational data (when include=identity_documents)
  identity_documents?: any[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || '';
    const customerId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Build base query
    let baseQuery = `
      SELECT c.*, 
             (SELECT MIN(cd.due_date) 
              FROM card_details cd 
              WHERE cd.customer_id = c.id) as card_due_date
      FROM customers c
    `;
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE clauses
    const whereConditions: string[] = [];

    if (customerId) {
      whereConditions.push(`c.id = $${paramIndex}`);
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        c.full_name ILIKE $${paramIndex} OR 
        c.email_id ILIKE $${paramIndex} OR 
        c.contact_no ILIKE $${paramIndex} OR
        c.pan_no ILIKE $${paramIndex} OR
        c.aadhaar_no ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY c.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Execute base customer query
    const { rows: customers } = await query(baseQuery, queryParams);

    // Include cards if requested
    if (include.includes('cards') && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      const { rows: cards } = await query(
        'SELECT * FROM card_details WHERE customer_id = ANY($1) ORDER BY id DESC',
        [customerIds]
      );
      
      const cardsMap = new Map();
      cards.forEach(card => {
        if (!cardsMap.has(card.customer_id)) {
          cardsMap.set(card.customer_id, []);
        }
        cardsMap.get(card.customer_id).push(card);
      });
      
      customers.forEach(customer => {
        customer.cards = cardsMap.get(customer.id) || [];
      });
    }

    // Include transactions if requested
    if (include.includes('transactions') && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      const { rows: transactions } = await query(
        'SELECT * FROM transactions WHERE customer_id = ANY($1) ORDER BY created_at DESC LIMIT 50',
        [customerIds]
      );
      
      const transactionsMap = new Map();
      transactions.forEach(transaction => {
        if (!transactionsMap.has(transaction.customer_id)) {
          transactionsMap.set(transaction.customer_id, []);
        }
        transactionsMap.get(transaction.customer_id).push(transaction);
      });
      
      customers.forEach(customer => {
        customer.transactions = transactionsMap.get(customer.id) || [];
      });
    }

    // Include accounts if requested
    if (include.includes('accounts') && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      const { rows: accounts } = await query(
        'SELECT * FROM accounts WHERE customer_id = ANY($1) ORDER BY id DESC',
        [customerIds]
      );
      
      const accountsMap = new Map();
      accounts.forEach(account => {
        if (!accountsMap.has(account.customer_id)) {
          accountsMap.set(account.customer_id, []);
        }
        accountsMap.get(account.customer_id).push(account);
      });
      
      customers.forEach(customer => {
        customer.accounts = accountsMap.get(customer.id) || [];
      });
    }

    // Include tax details if requested
    if (include.includes('tax_details') && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      const { rows: taxDetails } = await query(
        'SELECT * FROM customer_tax_details WHERE customer_id = ANY($1) ORDER BY id DESC',
        [customerIds]
      );
      
      const taxDetailsMap = new Map();
      taxDetails.forEach(taxDetail => {
        if (!taxDetailsMap.has(taxDetail.customer_id)) {
          taxDetailsMap.set(taxDetail.customer_id, []);
        }
        taxDetailsMap.get(taxDetail.customer_id).push(taxDetail);
      });
      
      customers.forEach(customer => {
        customer.tax_details = taxDetailsMap.get(customer.id) || [];
      });
    }

    // Include identity documents if requested
    if (include.includes('identity_documents') && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      const { rows: identityDocuments } = await query(
        'SELECT * FROM identity_documents WHERE customer_id = ANY($1) ORDER BY id DESC',
        [customerIds]
      );
      
      const identityDocumentsMap = new Map();
      identityDocuments.forEach(doc => {
        if (!identityDocumentsMap.has(doc.customer_id)) {
          identityDocumentsMap.set(doc.customer_id, []);
        }
        identityDocumentsMap.get(doc.customer_id).push(doc);
      });
      
      customers.forEach(customer => {
        customer.identity_documents = identityDocumentsMap.get(customer.id) || [];
      });
    }

    return NextResponse.json({
      success: true,
      data: customers,
      count: customers.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Customers API error:', error);
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
    const { full_name, email_id, contact_no, pan_no, aadhaar_no } = body;

    // Validate required fields
    if (!full_name || !email_id || !contact_no) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: full_name, email_id, contact_no' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await query(
      'SELECT id FROM customers WHERE email_id = $1',
      [email_id]
    );
    if (existingEmail.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Check if contact number already exists
    const existingContact = await query(
      'SELECT id FROM customers WHERE contact_no = $1',
      [contact_no]
    );
    if (existingContact.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Contact number already exists' },
        { status: 400 }
      );
    }

    // Insert new customer
    const insertQuery = `
      INSERT INTO customers (full_name, email_id, contact_no, pan_no, aadhaar_no)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [
      full_name, email_id, contact_no, pan_no, aadhaar_no
    ]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Customers POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
