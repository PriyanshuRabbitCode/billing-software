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

    // Get current pending amount for the card (across all customers)
    const { rows: pendingData } = await query(
      `SELECT 
        COALESCE(SUM(pending_amount), 0) as total_pending
       FROM transactions 
       WHERE card_number = $1`,
      [cardNumber]
    );

    if (pendingData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Card not found or no transactions exist for this card' },
        { status: 400 }
      );
    }

    const currentPending = parseFloat(pendingData[0]?.total_pending || '0');
    
    // Get the customer_id for this specific card from card_details table
    const { rows: cardData } = await query(
      'SELECT customer_id FROM card_details WHERE card_number = $1',
      [cardNumber]
    );
    
    const dbCustomerId = cardData.length > 0 ? cardData[0]?.customer_id : null;
    
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
        { 
          success: false, 
          error: `Payment amount ₹${amount} cannot exceed pending amount ₹${currentPending}` 
        },
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
-      pending_amount: -amount, // Negative to reduce the total pending amount
+      pending_amount: 0, // Payments never store negative pending; reduce pending via updates to existing transactions
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

-    // Calculate new pending amount
-    const newPendingAmount = currentPending - amount;
+    // Reduce pending_amount across existing positive-pending transactions for this card
+    let remaining = amount;
+    const { rows: positivePendingTxs } = await query(
+      `SELECT id, pending_amount FROM transactions WHERE card_number = $1 AND pending_amount > 0 ORDER BY created_at ASC`,
+      [cardNumber]
+    );
+    for (const tx of positivePendingTxs) {
+      if (remaining <= 0) break;
+      const current = Number(tx.pending_amount || 0);
+      const reduce = Math.min(current, remaining);
+      if (reduce > 0) {
+        await query(
+          `UPDATE transactions SET pending_amount = GREATEST(pending_amount - $1, 0) WHERE id = $2`,
+          [reduce, tx.id]
+        );
+        remaining -= reduce;
+      }
+    }
+
+    // Recompute pending amount after updates
+    const { rows: pendingAfterRows } = await query(
+      `SELECT COALESCE(SUM(pending_amount), 0) as total_pending FROM transactions WHERE card_number = $1`,
+      [cardNumber]
+    );
+    const newPendingAmount = Math.max(0, parseFloat(pendingAfterRows[0]?.total_pending || '0'));
    
    // If pending amount becomes 0 or less, automatically move the original pending amount to received amount
    if (newPendingAmount <= 0) {
      try {
        // Get the original pending amount that was just paid off
        const originalPendingAmount = currentPending;
        
        // Find the main transaction (the one with positive pending amount) for this card
        const { rows: mainTransactionRows } = await query(
          `SELECT id, pending_amount, deposit_amount, withdraw_amount 
           FROM transactions 
           WHERE card_number = $1 AND pending_amount > 0 
           ORDER BY created_at ASC 
           LIMIT 1`,
          [cardNumber]
        );
        
        if (mainTransactionRows.length > 0) {
          const mainTransaction = mainTransactionRows[0];
          
          // Update the main transaction to move pending amount to received amount
          await query(
            `UPDATE transactions 
             SET pending_amount = 0,
                 deposit_amount = deposit_amount + $1
             WHERE id = $2`,
            [originalPendingAmount, mainTransaction.id]
          );
          
          console.log(`Moved pending amount ${originalPendingAmount} to received amount for transaction ${mainTransaction.id}`);
        }

        // Removed auto-renew of stored due_date; next due should be computed from due_day at read time
      } catch (updateError) {
        console.error('Error updating received amount or renewing due date after pending amount paid:', updateError);
        // Don't fail the payment if this update fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        transaction: rows[0],
        newPendingAmount: Math.max(0, newPendingAmount),
        paymentAmount: amount,
        paymentMode,
        pendingAmountMovedToReceived: newPendingAmount <= 0 ? currentPending : 0
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
