import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/postgres';
import { schemas } from '@/lib/tableSchemas';

// TypeScript interfaces for better type safety
interface RouteParams {
  id: string;
}

interface RouteContext {
  params: Promise<RouteParams>;
}

// Helper function for error responses
function createErrorResponse(message: string, status: number = 500) {
  return NextResponse.json(
    { 
      error: message,
      timestamp: new Date().toISOString(),
      status 
    }, 
    { status }
  );
}

// Helper function for success responses
function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Validate and parse ID
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return createErrorResponse("Invalid id", 400);
    }

    // Execute query
    const { rows } = await query(
      'SELECT * FROM customers WHERE id = $1',
      [numericId]
    );
    
    if (rows.length === 0) {
      return createErrorResponse('Customer not found', 404);
    }

    return createSuccessResponse(rows[0]);
  } catch (error: any) {
    console.error('GET customer error:', error);
    return createErrorResponse(error.message || 'Internal server error');
  }
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Validate and parse ID
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return createErrorResponse("Invalid id", 400);
    }

    // Get schema for validation
    const schema = schemas.customers;
    const allowedFields = new Set(schema.fields.map((f) => f.name));

    // Parse request body
    let body: any;
    try {
      body = await req.json();
    } catch (error) {
      return createErrorResponse("Invalid JSON in request body", 400);
    }

    // Filter valid fields
    const entries = Object.entries(body).filter(([k]) => allowedFields.has(k));
    if (entries.length === 0) {
      return createErrorResponse("No valid fields provided", 400);
    }

    // Validate required fields
    const requiredFields = schema.fields.filter(f => f.required);
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (body.hasOwnProperty(field.name)) {
        const value = body[field.name];
        if (value === undefined || value === null || value === "") {
          missingFields.push(field.label || field.name);
        }
      }
    }
    
    if (missingFields.length > 0) {
      return createErrorResponse(`Required fields missing: ${missingFields.join(", ")}`, 400);
    }

    // Build update query
    const assignments = entries.map(([k], i) => `${k} = $${i + 1}`);
    const values = entries.map(([, v]) => v);
    values.push(numericId);

    // Execute update
    const { rows } = await query(
      `UPDATE customers SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return createErrorResponse('Customer not found', 404);
    }
    
    return createSuccessResponse(rows[0]);
  } catch (error: any) {
    console.error('PATCH customer error:', error);
    return createErrorResponse(error.message || 'Internal server error');
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Validate and parse ID
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return createErrorResponse("Invalid id", 400);
    }

    // Check if customer exists before deleting
    const checkResult = await query('SELECT COUNT(*) as count FROM customers WHERE id = $1', [numericId]);
    if (checkResult.rows[0]?.count === 0) {
      return createErrorResponse('Customer not found', 404);
    }

    // Delete the customer using direct pool connection for better control
    const client = await getPool().connect();
    try {
      await client.query('DELETE FROM customers WHERE id = $1', [numericId]);
    } finally {
      client.release();
    }

    return createSuccessResponse({ ok: true });
  } catch (error: any) {
    console.error('DELETE customer error:', error);
    return createErrorResponse(error.message || 'Internal server error');
  }
}
