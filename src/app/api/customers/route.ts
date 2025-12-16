import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { AppError, handleDatabaseError, logError } from '@/lib/errorHandling';

export const runtime = 'nodejs';

interface CustomerWithRelations {
  id: number;
  full_name: string;
  billing_address: string;
  city: string;
  state: string;
  pin_code: string;
  email_id: string;
  contact_no: string;
  created_at: string;
  updated_at: string;
  next_due_date?: string;
  due_day?: number;
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
    // Normalize empty search params like "/api/customers?" → behave as "/api/customers"
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    // Remove empty params (e.g., "?" or "?foo=")
    for (const [key, value] of Array.from(searchParams.entries())) {
      if (value === null || value === undefined || String(value).trim() === '') {
        searchParams.delete(key);
      }
    }

    const include = searchParams.get('include') || '';
    const customerId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    // Build base query
    let baseQuery = `
      SELECT c.*, 
             (SELECT MIN(
                CASE 
                  WHEN cd2.due_day IS NOT NULL THEN (
                    CASE 
                      WHEN make_date(
                        EXTRACT(YEAR FROM CURRENT_DATE)::int,
                        EXTRACT(MONTH FROM CURRENT_DATE)::int,
                        LEAST(cd2.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                      ) >= CURRENT_DATE
                      THEN make_date(
                        EXTRACT(YEAR FROM CURRENT_DATE)::int,
                        EXTRACT(MONTH FROM CURRENT_DATE)::int,
                        LEAST(cd2.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                      )
                      ELSE make_date(
                        EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                        LEAST(cd2.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                      )
                    END
                  )
                  ELSE NULL
                END
              ) 
              FROM card_details cd2 
              WHERE cd2.customer_id = c.id) as next_due_date,
             (SELECT MIN(cd3.due_day) FROM card_details cd3 WHERE cd3.customer_id = c.id) as due_day
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
        c.contact_no ILIKE $${paramIndex}
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
        `
        SELECT 
          cd.*, 
          CASE 
            WHEN cd.due_day IS NOT NULL THEN (
              CASE 
                WHEN make_date(
                  EXTRACT(YEAR FROM CURRENT_DATE)::int,
                  EXTRACT(MONTH FROM CURRENT_DATE)::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                ) >= CURRENT_DATE
                THEN make_date(
                  EXTRACT(YEAR FROM CURRENT_DATE)::int,
                  EXTRACT(MONTH FROM CURRENT_DATE)::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                )
                ELSE make_date(
                  EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                  EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                  LEAST(cd.due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
                )
              END
            )
            ELSE NULL
          END AS next_due_date
        FROM card_details cd
        WHERE cd.customer_id = ANY($1)
        ORDER BY cd.id DESC
        `,
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

    // Include card pending amounts if requested
    if (include.includes('card_pending_amounts') && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      
      // Calculate card pending amounts dynamically from transactions
      const { rows: cardPendingAmounts } = await query(`
        SELECT 
          t.customer_id,
          REPLACE(t.card_number, ' ', '') as card_number,
          MAX(t.card_name) as card_name,
          COALESCE(SUM(t.deposit_amount), 0) as received_amount,
          GREATEST(COALESCE(SUM(t.pending_amount), 0), 0) as pending_amount
        FROM transactions t
        WHERE t.customer_id = ANY($1) 
          AND t.card_number IS NOT NULL 
          AND REPLACE(t.card_number, ' ', '') != ''
        GROUP BY t.customer_id, REPLACE(t.card_number, ' ', '')
        ORDER BY t.customer_id, REPLACE(t.card_number, ' ', '')
      `, [customerIds]);
      
      // Add customer names to the card pending amounts data
      const customerNamesMap = new Map(customers.map(c => [c.id, c.full_name]));
      cardPendingAmounts.forEach(cardPending => {
        cardPending.customer_name = customerNamesMap.get(cardPending.customer_id);
      });
      
      const cardPendingAmountsMap = new Map();
      cardPendingAmounts.forEach(cardPending => {
        if (!cardPendingAmountsMap.has(cardPending.customer_id)) {
          cardPendingAmountsMap.set(cardPending.customer_id, []);
        }
        cardPendingAmountsMap.get(cardPending.customer_id).push(cardPending);
      });
      
      customers.forEach(customer => {
        customer.card_pending_amounts = cardPendingAmountsMap.get(customer.id) || [];
      });
    }

    return NextResponse.json({
      success: true,
      data: customers,
      count: customers.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError(error, 'Customers API: GET');
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: error.code
        },
        { status: error.status }
      );
    }
    
    // Handle database errors
    if (error instanceof Error && error.message.includes('database')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database operation failed. Please try again.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { full_name, email_id, contact_no, billing_address, city, state, pin_code, pan_no, aadhaar_no } = body;

    // Validate required fields
    if (!full_name || !email_id || !contact_no || !billing_address || !city || !state || !pin_code) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: full_name, email_id, contact_no, billing_address, city, state, pin_code' },
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
      INSERT INTO customers (full_name, email_id, contact_no, billing_address, city, state, pin_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await query(insertQuery, [
      full_name, email_id, contact_no, billing_address, city, state, pin_code
    ]);

    const newCustomer = rows[0];

    // Insert tax details if provided
    if (pan_no || aadhaar_no) {
      try {
        // Clean Aadhaar number by removing spaces and non-digits
        const cleanAadhaarNo = aadhaar_no ? aadhaar_no.replace(/\s/g, '').replace(/\D/g, '') : null;
        
        await query(
          `INSERT INTO customer_tax_details (customer_id, pan_no, aadhaar_no)
           VALUES ($1, $2, $3)`,
          [newCustomer.id, pan_no || null, cleanAadhaarNo]
        );
      } catch (taxError) {
        console.warn('Failed to insert tax details:', taxError);
        // Don't fail the customer creation if tax details fail
      }
    }

    return NextResponse.json({
      success: true,
      data: newCustomer,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    logError(error, 'Customers API: POST');
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: error.code
        },
        { status: error.status }
      );
    }
    
    // Handle database constraint errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'A customer with this information already exists.',
            code: 'DUPLICATE_CUSTOMER'
          },
          { status: 409 }
        );
      }
      
      if (error.message.includes('foreign key')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid customer reference.',
            code: 'INVALID_REFERENCE'
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create customer. Please try again.',
        code: 'CREATE_FAILED'
      },
      { status: 500 }
    );
  }
}