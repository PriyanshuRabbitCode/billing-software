import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { field, value, customerId } = body;

    if (!field || !value) {
      return NextResponse.json({ error: "Field and value are required" }, { status: 400 });
    }

    // Validate field name to prevent SQL injection
    const allowedFields = ['email_id', 'pan_no', 'aadhaar_no', 'contact_no'];
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

    let exists = false;
    let tableName = 'customers';
    
    // Use appropriate table based on field
    if (field === 'pan_no' || field === 'aadhaar_no') {
      tableName = 'customer_tax_details';
    }

    // Check if value exists, excluding the current customer if customerId is provided
    let excludeClause = '';
    const params: any[] = [value];
    
    if (customerId) {
      if (field === 'pan_no' || field === 'aadhaar_no') {
        // For tax details, exclude by customer_id
        excludeClause = `AND customer_id != $2`;
      } else {
        // For customers table, exclude by id
        excludeClause = `AND id != $2`;
      }
      params.push(customerId);
    }

    const { rows } = await query(
      `SELECT id FROM ${tableName} WHERE ${field} = $1 ${excludeClause} LIMIT 1`,
      params
    );

    exists = rows.length > 0;

    // Format validation
    let formatError = null;
    if (field === 'email_id') {
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        formatError = "Invalid email format";
      }
    } else if (field === 'pan_no') {
      // PAN format validation (ABCDE1234F)
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(value)) {
        formatError = "Invalid PAN format. Should be like ABCDE1234F";
      }
    } else if (field === 'aadhaar_no') {
      // Aadhaar format validation (12 digits)
      const aadhaarRegex = /^[0-9]{12}$/;
      if (!aadhaarRegex.test(value)) {
        formatError = "Invalid Aadhaar format. Should be 12 digits";
      }
    } else if (field === 'contact_no') {
      // Contact number format validation (10 digits, optionally with country code)
      const contactRegex = /^(\+91\s?)?[6-9]\d{9}$/;
      if (!contactRegex.test(value)) {
        formatError = "Invalid contact number format. Should be 10 digits starting with 6-9, optionally with +91 country code";
      }
    }

    return NextResponse.json({
      exists,
      formatError,
      message: formatError ? formatError : (exists ? `This ${field.replace('_', ' ')} is already in use` : "Available")
    });
  } catch (e: any) {
    console.error('Error checking unique field:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
