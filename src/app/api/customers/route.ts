import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { schemas } from '@/lib/tableSchemas';
import { apiCache } from '@/lib/cache';

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
  // Relational data (when include=relations)
  tax_details?: any[];
  identity_documents?: any[];
  accounts?: any[];
  cards?: any[];
  transactions?: any[];
  card_pending_amounts?: any[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include');
    const customerId = searchParams.get('id');
    const limit = searchParams.get('limit') || '1000';
    const offset = searchParams.get('offset') || '0';
    const search = searchParams.get('search');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Create cache key
    const cacheKey = `customers-${include || 'basic'}-${customerId || 'all'}-${limit}-${offset}-${search || ''}`;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = apiCache.get<CustomerWithRelations[]>(cacheKey);
      if (cachedData) {
        return NextResponse.json({
          data: cachedData,
          cached: true,
          timestamp: Date.now()
        });
      }
    }

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
    queryParams.push(Number(limit), Number(offset));

    // Execute base customer query
    const { rows: customers } = await query(baseQuery, queryParams);

    // If include=relations is requested, fetch related data in parallel
    if (include === 'relations' && customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      
      // Execute all relational queries in parallel
      const [
        taxDetailsResult,
        identityDocumentsResult,
        accountsResult,
        cardsResult,
        transactionsResult,
        cardPendingResult
      ] = await Promise.all([
        // Tax details
        query(`
          SELECT * FROM customer_tax_details 
          WHERE customer_id = ANY($1)
          ORDER BY id DESC
        `, [customerIds]),
        
        // Identity documents
        query(`
          SELECT * FROM identity_documents 
          WHERE customer_id = ANY($1)
          ORDER BY id DESC
        `, [customerIds]),
        
        // Customer accounts
        query(`
          SELECT * FROM customer_accounts 
          WHERE customer_id = ANY($1)
          ORDER BY id DESC
        `, [customerIds]),
        
        // Card details
        query(`
          SELECT * FROM card_details 
          WHERE customer_id = ANY($1)
          ORDER BY id DESC
        `, [customerIds]),
        
        // Transactions
        query(`
          SELECT * FROM transactions 
          WHERE customer_id = ANY($1)
          ORDER BY transaction_date DESC
        `, [customerIds]),
        
        // Card pending amounts
        query(`
          SELECT * FROM card_pending_amounts 
          WHERE customer_id = ANY($1)
          ORDER BY id DESC
        `, [customerIds])
      ]);

      // Group related data by customer_id
      const taxDetailsByCustomer = taxDetailsResult.rows.reduce((acc, item) => {
        if (!acc[item.customer_id]) acc[item.customer_id] = [];
        acc[item.customer_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      const identityDocsByCustomer = identityDocumentsResult.rows.reduce((acc, item) => {
        if (!acc[item.customer_id]) acc[item.customer_id] = [];
        acc[item.customer_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      const accountsByCustomer = accountsResult.rows.reduce((acc, item) => {
        if (!acc[item.customer_id]) acc[item.customer_id] = [];
        acc[item.customer_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      const cardsByCustomer = cardsResult.rows.reduce((acc, item) => {
        if (!acc[item.customer_id]) acc[item.customer_id] = [];
        acc[item.customer_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      const transactionsByCustomer = transactionsResult.rows.reduce((acc, item) => {
        if (!acc[item.customer_id]) acc[item.customer_id] = [];
        acc[item.customer_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      const cardPendingByCustomer = cardPendingResult.rows.reduce((acc, item) => {
        if (!acc[item.customer_id]) acc[item.customer_id] = [];
        acc[item.customer_id].push(item);
        return acc;
      }, {} as Record<number, any[]>);

      // Attach related data to customers
      const customersWithRelations = customers.map(customer => ({
        ...customer,
        tax_details: taxDetailsByCustomer[customer.id] || [],
        identity_documents: identityDocsByCustomer[customer.id] || [],
        accounts: accountsByCustomer[customer.id] || [],
        cards: cardsByCustomer[customer.id] || [],
        transactions: transactionsByCustomer[customer.id] || [],
        card_pending_amounts: cardPendingByCustomer[customer.id] || []
      }));

      // Cache the result
      apiCache.set(cacheKey, customersWithRelations, 5 * 60 * 1000); // 5 minutes

      return NextResponse.json({
        data: customersWithRelations,
        cached: false,
        timestamp: Date.now()
      });
    }

    // Cache basic customer data
    apiCache.set(cacheKey, customers, 10 * 60 * 1000); // 10 minutes

    return NextResponse.json({
      data: customers,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('Customers API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customers' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const schema = schemas.customers;
    const allowedFields = new Set(schema.fields.map((f) => f.name));

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Filter valid fields
    const entries = Object.entries(body).filter(([k]) => allowedFields.has(k));
    if (entries.length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    // Validate required fields
    const requiredFields = schema.fields.filter(f => f.required);
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!body.hasOwnProperty(field.name) || 
          body[field.name] === undefined || 
          body[field.name] === null || 
          body[field.name] === "") {
        missingFields.push(field.label || field.name);
      }
    }
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: `Required fields missing: ${missingFields.join(", ")}` 
      }, { status: 400 });
    }

    // Build insert query
    const columns = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await query(
      `INSERT INTO customers (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    // Invalidate customer cache
    const keysToDelete: string[] = [];
    for (const [key] of apiCache['cache']) {
      if (key.startsWith('customers-')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => apiCache.delete(key));

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('POST customer error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' }, 
      { status: 500 }
    );
  }
}

// POST method to invalidate cache
export async function PATCH(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'invalidate-cache') {
      // Clear all customer-related cache
      const keysToDelete: string[] = [];
      for (const [key] of apiCache['cache']) {
        if (key.startsWith('customers-')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => apiCache.delete(key));
      
      return NextResponse.json({ 
        success: true, 
        message: 'Customer cache invalidated',
        cleared_keys: keysToDelete.length
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error: any) {
    console.error('Customer cache invalidation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invalidate cache' }, 
      { status: 500 }
    );
  }
}
