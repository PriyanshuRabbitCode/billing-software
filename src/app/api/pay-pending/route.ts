import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardNumber, paymentMode, paidAmount } = body;

    // Validate required fields
    if (!cardNumber || !paymentMode || !paidAmount) {
      return NextResponse.json({ 
        error: "Missing required fields: cardNumber, paymentMode, paidAmount" 
      }, { status: 400 });
    }

    // Validate payment mode
    const validPaymentModes = ['UPI', 'Card', 'Cash', 'Net Banking'];
    if (!validPaymentModes.includes(paymentMode)) {
      return NextResponse.json({ 
        error: "Invalid payment mode. Must be one of: UPI, Card, Cash, Net Banking" 
      }, { status: 400 });
    }

    // Validate paid amount
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ 
        error: "Invalid paid amount. Must be a positive number" 
      }, { status: 400 });
    }

    // Get current pending amount for the card
    const pendingQuery = `
      SELECT 
        cd.card_number,
        cd.card_name,
        cd.customer_id,
        c.full_name as customer_name,
        COALESCE(SUM(t.pending_amount), 0) as total_pending_amount
      FROM card_details cd
      LEFT JOIN customers c ON cd.customer_id = c.id
      LEFT JOIN transactions t ON cd.card_number = t.card_number
      WHERE cd.card_number = $1
      GROUP BY cd.card_number, cd.card_name, cd.customer_id, c.full_name
    `;

    const pendingResult = await query(pendingQuery, [cardNumber]);
    
    if (pendingResult.rows.length === 0) {
      return NextResponse.json({ 
        error: "Card not found" 
      }, { status: 404 });
    }

    const cardData = pendingResult.rows[0];
    
    // Calculate current pending amount using the same logic as card-pending-amounts API
    const currentPendingQuery = `
      SELECT COALESCE(SUM(CASE 
        WHEN t.withdraw_amount > 0 THEN 
          CASE 
            WHEN t.add_tax_to_withdraw = true THEN t.deposit_amount - t.withdraw_amount
            ELSE (t.deposit_amount - t.withdraw_amount) + t.tax_amount
          END
        ELSE 0 
      END), 0) - COALESCE(SUM(CASE 
        WHEN t.withdraw_amount = 0 AND t.deposit_amount > 0 AND t.pos_type IS NULL THEN t.deposit_amount
        ELSE 0 
      END), 0) as current_pending_amount
      FROM transactions t 
      WHERE t.card_number = $1
    `;
    
    const currentPendingResult = await query(currentPendingQuery, [cardNumber]);
    const currentPendingAmount = parseFloat(currentPendingResult.rows[0].current_pending_amount || 0);

    // Check if paid amount is valid
    if (amount > currentPendingAmount) {
      return NextResponse.json({ 
        error: `Paid amount (₹${amount}) cannot be greater than pending amount (₹${currentPendingAmount})` 
      }, { status: 400 });
    }


    
    // Recalculate the actual pending amount from all transactions (including payments)
    const recalculateQuery = `
      SELECT COALESCE(SUM(CASE 
        WHEN t.withdraw_amount > 0 THEN 
          CASE 
            WHEN t.add_tax_to_withdraw = true THEN t.deposit_amount - t.withdraw_amount
            ELSE (t.deposit_amount - t.withdraw_amount) + t.tax_amount
          END
        ELSE 0 
      END), 0) - COALESCE(SUM(CASE 
        WHEN t.withdraw_amount = 0 AND t.deposit_amount > 0 AND t.pos_type IS NULL THEN t.deposit_amount
        ELSE 0 
      END), 0) as actual_pending_amount
      FROM transactions t 
      WHERE t.card_number = $1
    `;
    
    const recalculateResult = await query(recalculateQuery, [cardNumber]);
    const actualPendingAmount = parseFloat(recalculateResult.rows[0].actual_pending_amount || 0);

    // Create a new transaction to record the payment
    const paymentTransaction = {
      customer_id: cardData.customer_id,
      card_number: cardNumber,
      card_name: cardData.card_name,
      deposit_amount: amount, // Payment is treated as a deposit
      withdraw_amount: 0,
      payable_amount: amount,
      pos_type: null,
      tax_rate: 0,
      tax_amount: 0,
      mdr_amount: 0,
      mdr_charge_amount: 0,
      profit_amount: 0,
      add_tax_to_withdraw: false,
      pending_amount: 0, // Payment transactions have 0 pending amount
      status: "PAID",
      transaction_date: new Date().toISOString(),
      payment_mode: paymentMode,
      payment_note: `Payment received via ${paymentMode}`
    };

    // Insert the payment transaction
    const insertQuery = `
      INSERT INTO transactions (
        customer_id, card_number, card_name, deposit_amount, withdraw_amount,
        payable_amount, pos_type, tax_rate, tax_amount, mdr_amount, mdr_charge_amount,
        profit_amount, add_tax_to_withdraw, pending_amount, status, transaction_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const insertResult = await query(insertQuery, [
      paymentTransaction.customer_id,
      paymentTransaction.card_number,
      paymentTransaction.card_name,
      paymentTransaction.deposit_amount,
      paymentTransaction.withdraw_amount,
      paymentTransaction.payable_amount,
      paymentTransaction.pos_type,
      paymentTransaction.tax_rate,
      paymentTransaction.tax_amount,
      paymentTransaction.mdr_amount,
      paymentTransaction.mdr_charge_amount,
      paymentTransaction.profit_amount,
      paymentTransaction.add_tax_to_withdraw,
      paymentTransaction.pending_amount,
      paymentTransaction.status,
      paymentTransaction.transaction_date
    ]);



    return NextResponse.json({
      success: true,
      message: `Payment of ₹${amount} received successfully via ${paymentMode}`,
      data: {
        cardNumber,
        cardName: cardData.card_name,
        customerName: cardData.customer_name,
        previousPendingAmount: currentPendingAmount,
        paidAmount: amount,
        newPendingAmount: actualPendingAmount,
        paymentMode,
        transactionId: insertResult.rows[0].id
      }
    });

  } catch (error: unknown) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process payment' 
    }, { status: 500 });
  }
}
