import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardNumber, customerId: requestCustomerId, paymentMode, paidAmount } = body;

    // Validate required fields
    if (!cardNumber || !paymentMode || !paidAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: cardNumber, paymentMode, paidAmount' },
        { status: 400 }
      );
    }

    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    // Get current pending amount and customer_id for the card
    const { rows: pendingData } = await query(
      `SELECT 
        COALESCE(SUM(pending_amount), 0) as total_pending,
        customer_id
       FROM transactions 
       WHERE card_number = $1
       GROUP BY customer_id`,
      [cardNumber]
    );

    if (pendingData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Card not found or no transactions exist for this card' },
        { status: 400 }
      );
    }

    const currentPending = parseFloat(pendingData[0]?.total_pending || '0');
    const dbCustomerId = pendingData[0]?.customer_id;
    
    // Use provided customerId if available, otherwise use the one from database
    const customerId = requestCustomerId || dbCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID not found for this card' },
        { status: 400 }
      );
    }

    if (amount > currentPending) {
      return NextResponse.json(
        { success: false, error: 'Payment amount cannot exceed pending amount' },
        { status: 400 }
      );
    }

    // Create a new transaction to record the payment
    const paymentTransaction = {
      card_number: cardNumber,
      deposit_amount: 0, // No deposit for payments
      withdraw_amount: amount, // Payment amount goes to withdraw
      payable_amount: amount,
      add_tax_to_withdraw: false,
      pos_type: paymentMode,
      tax_rate: 0,
      tax_amount: 0,
      mdr_amount: 0,
      mdr_charge_amount: 0,
      profit_amount: 0,
      pending_amount: 0, // This will be calculated by the system
      status: 'PAID'
    };

    // Insert the payment transaction
    const insertQuery = `
      INSERT INTO transactions (
        customer_id, card_number, deposit_amount, withdraw_amount, payable_amount,
        add_tax_to_withdraw, pos_type, tax_rate, tax_amount,
        mdr_amount, mdr_charge_amount, profit_amount, pending_amount, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const { rows } = await query(insertQuery, [
      customerId,
      paymentTransaction.card_number,
      paymentTransaction.deposit_amount,
      paymentTransaction.withdraw_amount,
      paymentTransaction.payable_amount,
      paymentTransaction.add_tax_to_withdraw,
      paymentTransaction.pos_type,
      paymentTransaction.tax_rate,
      paymentTransaction.tax_amount,
      paymentTransaction.mdr_amount,
      paymentTransaction.mdr_charge_amount,
      paymentTransaction.profit_amount,
      paymentTransaction.pending_amount,
      paymentTransaction.status
    ]);

    // Calculate new pending amount
    const newPendingAmount = currentPending - amount;

    return NextResponse.json({
      success: true,
      data: {
        transaction: rows[0],
        newPendingAmount: Math.max(0, newPendingAmount),
        paymentAmount: amount,
        paymentMode
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Payment API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
