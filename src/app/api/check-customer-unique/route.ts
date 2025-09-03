import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { field, value, customerId } = body;

    if (!field || !value) {
      return NextResponse.json(
        { success: false, error: 'Field and value are required' },
        { status: 400 }
      );
    }

    // Validate allowed fields
    const allowedFields = ['email_id', 'contact_no', 'pan_no', 'aadhaar_no'];
    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { success: false, error: 'Invalid field' },
        { status: 400 }
      );
    }

    // Format validation
    let formatError = null;
    
    if (field === 'email_id') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        formatError = 'Invalid email format';
      }
    } else if (field === 'contact_no') {
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(value)) {
        formatError = 'Contact number must be 10-15 digits';
      }
    } else if (field === 'pan_no') {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(value)) {
        formatError = 'Invalid PAN format. Format should be: AAAAA1234A';
      }
    } else if (field === 'aadhaar_no') {
      const aadhaarRegex = /^\d{12}$/;
      if (!aadhaarRegex.test(value)) {
        formatError = 'Aadhaar number must be 12 digits';
      }
    }

    if (formatError) {
      return NextResponse.json({
        success: true,
        exists: false,
        formatError
      });
    }

    // Check for uniqueness in customers table
    let checkQuery = '';
    let queryParams = [];

    if (field === 'email_id' || field === 'contact_no') {
      // Check in customers table
      if (customerId) {
        checkQuery = `SELECT id FROM customers WHERE ${field} = $1 AND id != $2`;
        queryParams = [value, customerId];
      } else {
        checkQuery = `SELECT id FROM customers WHERE ${field} = $1`;
        queryParams = [value];
      }
    } else if (field === 'pan_no' || field === 'aadhaar_no') {
      // Check in customer_tax_details table
      if (customerId) {
        checkQuery = `SELECT id FROM customer_tax_details WHERE ${field} = $1 AND customer_id != $2`;
        queryParams = [value, customerId];
      } else {
        checkQuery = `SELECT id FROM customer_tax_details WHERE ${field} = $1`;
        queryParams = [value];
      }
    }

    const { rows } = await query(checkQuery, queryParams);
    const exists = rows.length > 0;

    return NextResponse.json({
      success: true,
      exists,
      formatError: null
    });

  } catch (error) {
    console.error('Check uniqueness error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
