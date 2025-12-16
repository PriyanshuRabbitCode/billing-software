import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taxDetailId = parseInt(id);

    if (isNaN(taxDetailId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tax detail ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { customer_id, pan_no, aadhaar_no } = body;

    // Check if tax detail exists
    const { rows: existingTax } = await query(
      'SELECT * FROM customer_tax_details WHERE id = $1',
      [taxDetailId]
    );

    if (existingTax.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tax detail not found' },
        { status: 404 }
      );
    }

    // Build update query
    const allowedFields = ['customer_id', 'pan_no', 'aadhaar_no'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add tax detail ID to values
    values.push(taxDetailId);

    const updateQuery = `
      UPDATE customer_tax_details 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const { rows } = await query(updateQuery, values);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Customer tax details PATCH error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taxDetailId = parseInt(id);

    if (isNaN(taxDetailId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tax detail ID' },
        { status: 400 }
      );
    }

    // Check if tax detail exists
    const { rows: existingTax } = await query(
      'SELECT * FROM customer_tax_details WHERE id = $1',
      [taxDetailId]
    );

    if (existingTax.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tax detail not found' },
        { status: 404 }
      );
    }

    // Delete the tax detail
    await query('DELETE FROM customer_tax_details WHERE id = $1', [taxDetailId]);

    return NextResponse.json({
      success: true,
      message: 'Tax detail deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Customer tax details DELETE error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
