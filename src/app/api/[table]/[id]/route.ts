import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";
import { schemas } from "@/lib/tableSchemas";
import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRouteId } from "@/lib/api-utils";
import { getErrorMessage } from "@/lib/utils";

export const runtime = 'nodejs';

// TypeScript interfaces for better type safety
interface RouteParams {
  table: string;
  id: string;
}

interface RouteContext {
  params: Promise<RouteParams>;
}

const allowedTables = new Set(Object.values(schemas).map((s) => s.table));

function getTableSchema(table: string) {
  const entry = Object.values(schemas).find((s) => s.table === table);
  return entry ?? null;
}



export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { table, id } = params;

    // Validate table parameter
    if (!allowedTables.has(table)) {
      return createErrorResponse("Table not allowed", 400);
    }

    // Validate and parse ID
    const numericId = validateRouteId(id);
    if (!numericId) {
      return createErrorResponse("Invalid id", 400);
    }

    // Execute query
    const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [numericId]);
    
    if (rows.length === 0) {
      return createErrorResponse("Record not found", 404);
    }

    return createSuccessResponse(rows[0]);
  } catch (error: unknown) {
    console.error('GET error:', error);
    return createErrorResponse(getErrorMessage(error));
  }
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { table, id } = params;

    // Validate table parameter
    if (!allowedTables.has(table)) {
      return createErrorResponse("Table not allowed", 400);
    }

    // Validate and parse ID
    const numericId = validateRouteId(id);
    if (!numericId) {
      return createErrorResponse("Invalid id", 400);
    }

    // Get schema for validation
    const schema = getTableSchema(table);
    if (!schema) {
      return createErrorResponse("Schema not found", 400);
    }

    const allowedFields = new Set(schema.fields.map((f) => f.name));

    // Parse request body
    const body = await parseRequestBody(req);
    if (!body) {
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
        
        // Special handling for transactions table
        if (table === 'transactions') {
          if (body.transaction_type === 'credit' && (field.name === 'pos_type' || field.name === 'tax_rate')) {
            continue; // Skip validation for these fields in credit transactions
          }
          
          if (body.transaction_type === 'debit') {
            if (value === undefined || value === null || value === "") {
              missingFields.push(field.label || field.name);
            }
          }
        }
        // Special handling for accounts table
        else if (table === 'accounts') {
          if (field.name === 'credit_limit' && body.credit_allowed === true) {
            if (value === undefined || value === null || value === "") {
              missingFields.push(field.label || field.name);
            }
          } else if (field.name === 'credit_limit') {
            continue;
          } else {
            if (value === undefined || value === null || value === "") {
              missingFields.push(field.label || field.name);
            }
          }
        } else {
          if (value === undefined || value === null || value === "") {
            missingFields.push(field.label || field.name);
          }
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
      `UPDATE ${table} SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      return createErrorResponse("Record not found", 404);
    }

    // Handle card pending amount calculation for transactions
    if (table === 'transactions' && body.card_number) {
      try {
        await fetch(`${req.nextUrl.origin}/api/calculate-card-pending-amount`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_number: body.card_number })
        });
      } catch (cardPendingError) {
        console.error('Error calculating card pending amount:', cardPendingError);
        // Don't fail the transaction update if card pending calculation fails
      }
    }
    
    return createSuccessResponse(rows[0]);
  } catch (error: unknown) {
    console.error('PATCH error:', error);
    return createErrorResponse(getErrorMessage(error));
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { table, id } = params;

    // Validate table parameter
    if (!allowedTables.has(table)) {
      return createErrorResponse("Table not allowed", 400);
    }

    // Validate and parse ID
    const numericId = validateRouteId(id);
    if (!numericId) {
      return createErrorResponse("Invalid id", 400);
    }

    // Check if record exists before deleting
    const checkResult = await query(`SELECT COUNT(*) as count FROM ${table} WHERE id = $1`, [numericId]);
    if (checkResult.rows[0]?.count === 0) {
      return createErrorResponse("Record not found", 404);
    }

    // Execute delete
    await query(`DELETE FROM ${table} WHERE id = $1`, [numericId]);

    return createSuccessResponse({ ok: true });
  } catch (error: unknown) {
    console.error('DELETE error:', error);
    return createErrorResponse(getErrorMessage(error));
  }
}



