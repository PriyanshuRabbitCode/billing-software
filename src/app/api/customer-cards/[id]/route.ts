import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

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

// API endpoint to get cards for a specific customer
export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Validate customer ID
    if (!id) {
      return createErrorResponse("Customer ID is required", 400);
    }

    // Validate and parse ID
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return createErrorResponse("Invalid customer ID", 400);
    }

    // Get cards for this customer
    const { rows } = await query(
      `SELECT * FROM card_details WHERE customer_id = $1 ORDER BY id DESC`,
      [numericId]
    );
    
    // If we have cards, also fetch customer info
    if (rows.length > 0) {
      const { rows: customerRows } = await query(
        `SELECT * FROM customers WHERE id = $1`,
        [numericId]
      );
      
      if (customerRows.length > 0) {
        const customer = customerRows[0];
        // Add customer name to each card
        rows.forEach((card: any) => {
          card.customer_name = customer.full_name;
        });
      }
    }
    
    return createSuccessResponse(rows);
  } catch (error: any) {
    console.error('Error fetching customer cards:', error);
    return createErrorResponse(error.message || 'Internal server error');
  }
}
