import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';

interface TransactionWithRelations {
  id: number;
  customer_id: number;
  card_number: string;
  card_name: string;
  deposit_amount: number;
  withdraw_amount: number;
  payable_amount: number;
  add_tax_to_withdraw: boolean;
  pos_type: string;
  tax_rate: number;
  tax_amount: number;
  mdr_amount: number;
  mdr_charge_amount: number;
  profit_amount: number;
  pending_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Relational data (when include=customer)
  customer?: {
    id: number;
    full_name: string;
    email_id: string;
    contact_no: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || '';
    const transactionId = searchParams.get('id');
    const customerId = searchParams.get('customer_id');
    const cardNumber = searchParams.get('card_number');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build base query
    let baseQuery = 'SELECT t.* FROM transactions t';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE clauses
    const whereConditions: string[] = [];

    if (transactionId) {
      whereConditions.push(`t.id = $${paramIndex}`);
      queryParams.push(Number(transactionId));
      paramIndex++;
    }

    if (customerId) {
      whereConditions.push(`t.customer_id = $${paramIndex}`);
      queryParams.push(Number(customerId));
      paramIndex++;
    }

    if (cardNumber) {
      whereConditions.push(`REPLACE(t.card_number, ' ', '') = REPLACE($${paramIndex}, ' ', '')`);
      queryParams.push(cardNumber);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`t.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        t.card_name ILIKE $${paramIndex} OR 
        t.card_number ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`t.created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`t.created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Execute base query
    const { rows: transactions } = await query(baseQuery, queryParams);

    // Include customer data if requested
    if (include.includes('customer') && transactions.length > 0) {
      const customerIds = [...new Set(transactions.map(t => t.customer_id))];
      if (customerIds.length > 0) {
        const customerQuery = `
          SELECT id, full_name, email_id, contact_no 
          FROM customers 
          WHERE id = ANY($1::int[])
        `;
        const { rows: customers } = await query(customerQuery, [customerIds]);
        const customerMap = new Map(customers.map(c => [c.id, c]));
        transactions.forEach(transaction => {
          transaction.customer = customerMap.get(transaction.customer_id);
        });
      }
    }

    // Include card details if requested or if card_number exists
    if ((include.includes('cards') || transactions.some(t => t.card_number)) && transactions.length > 0) {
      const cardNumbersClean = [...new Set(transactions.map(t => t.card_number).filter(Boolean).map(n => String(n).replace(/\s/g, '')))];
      if (cardNumbersClean.length > 0) {
        const cardQuery = `
          SELECT REPLACE(card_number, ' ', '') AS norm_card_number, card_name, bank_name, card_type
          FROM card_details 
          WHERE REPLACE(card_number, ' ', '') = ANY($1::text[])
        `;
        const { rows: cards } = await query(cardQuery, [cardNumbersClean]);
        const cardMap = new Map(cards.map((c: any) => [c.norm_card_number, c]));
        transactions.forEach(transaction => {
          const n = String(transaction.card_number || '').replace(/\s/g, '');
          if (n) {
            const cardDetails = cardMap.get(n);
            if (cardDetails) {
              // Only update card_name if it's not already set
              if (!transaction.card_name) {
                transaction.card_name = cardDetails.card_name;
              }
              // Attach extra info for client rendering convenience
              (transaction as any).bank_name = cardDetails.bank_name;
              (transaction as any).card_type = cardDetails.card_type;
            }
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
      pagination: {
        limit,
        offset,
        hasMore: transactions.length === limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_id,
      card_number,
      card_name,
      deposit_amount,
      withdraw_amount,
      payable_amount,
      add_tax_to_withdraw,
      pos_type,
      tax_rate,
      tax_amount,
      mdr_amount,
      mdr_charge_amount,
      profit_amount,
      pending_amount,
      status
    } = body;

    // Validate required fields
    if (!customer_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: customer_id' },
        { status: 400 }
      );
    }

    // Normalize numeric inputs (map empty string/undefined to null, numbers otherwise)
    const payableAmountNum = (payable_amount === '' || payable_amount === undefined) ? null : (payable_amount !== null ? Number(payable_amount) : null);
    const taxRateNumInput = (tax_rate === '' || tax_rate === undefined) ? null : (tax_rate !== null ? Number(tax_rate) : null);
    const taxAmountNumInput = (tax_amount === '' || tax_amount === undefined) ? null : (tax_amount !== null ? Number(tax_amount) : null);
    const mdrRateNumInput = (mdr_amount === '' || mdr_amount === undefined) ? null : (mdr_amount !== null ? Number(mdr_amount) : null);
    const mdrChargeNumInput = (mdr_charge_amount === '' || mdr_charge_amount === undefined) ? null : (mdr_charge_amount !== null ? Number(mdr_charge_amount) : null);
    const profitNumInput = (profit_amount === '' || profit_amount === undefined) ? null : (profit_amount !== null ? Number(profit_amount) : null);
    const pendingNumInput = (pending_amount === '' || pending_amount === undefined) ? null : (pending_amount !== null ? Number(pending_amount) : null);
    const addTaxBool = Boolean(add_tax_to_withdraw);

    // Check if at least one amount is provided
    if (!deposit_amount && !withdraw_amount) {
      return NextResponse.json(
        { success: false, error: 'At least one amount (deposit or withdraw) is required' },
        { status: 400 }
      );
    }

    // Check if withdraw amount is greater than deposit amount
    const deposit = (deposit_amount === '' || deposit_amount === undefined || deposit_amount === null) ? 0 : Number(deposit_amount);
    const withdraw = (withdraw_amount === '' || withdraw_amount === undefined || withdraw_amount === null) ? 0 : Number(withdraw_amount);
    if (withdraw > deposit) {
      return NextResponse.json(
        { success: false, error: 'Withdraw Amount cannot be greater than Deposit Amount' },
        { status: 400 }
      );
    }

    // Credit Limit Validation
    try {
      // Get customer's account information (credit_allowed and credit_limit)
      const { rows: accountInfo } = await query(
        'SELECT credit_allowed, credit_limit FROM accounts WHERE customer_id = $1',
        [customer_id]
      );

      if (accountInfo.length > 0) {
        const { credit_allowed, credit_limit } = accountInfo[0];
        const creditLimitNum = parseFloat(credit_limit);
        if (credit_allowed && credit_limit && creditLimitNum > 0) {
          // Calculate current total pending amount for this customer
          const { rows: currentPending } = await query(
            'SELECT COALESCE(SUM(pending_amount), 0) as total_pending FROM transactions WHERE customer_id = $1',
            [customer_id]
          );
          const currentTotalPending = parseFloat(currentPending[0]?.total_pending || 0);

          // Calculate what the new pending amount would be after this transaction
          let transactionPendingAmount = 0;
          if (addTaxBool) {
            // If tax is added to withdraw: Pending = Deposit - Withdraw
            transactionPendingAmount = deposit - withdraw;
          } else {
            // If tax is not added to withdraw: Pending = (Deposit - Withdraw) + Tax Amount
            const taxAmountForPending = taxAmountNumInput || 0;
            transactionPendingAmount = (deposit - withdraw) + taxAmountForPending;
          }

          // Calculate new total pending amount
          const newTotalPending = currentTotalPending + transactionPendingAmount;

          // Check if current total pending already exceeds credit limit
          if (currentTotalPending > creditLimitNum) {
            return NextResponse.json(
              { 
                success: false, 
                error: `⚠️ Transaction Declined:\nThis payment cannot be processed because your current pending transactions already exceed your credit limit.\n\nCredit Limit: ₹${creditLimitNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nCurrent Pending Transactions: ₹${currentTotalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nPlease clear your pending dues before making new transactions.` 
              },
              { status: 400 }
            );
          }

          // Check if new transaction would exceed credit limit
          if (newTotalPending > creditLimitNum) {
            const transactionAmount = newTotalPending - currentTotalPending;
            return NextResponse.json(
              { 
                success: false, 
                error: `⚠️ Transaction Declined:\nThis payment cannot be processed because it would exceed your credit limit.\n\nCredit Limit: ₹${creditLimitNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nCurrent Pending Transactions: ₹${currentTotalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nThis Transaction Amount: ₹${transactionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nResulting Total: ₹${newTotalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (exceeds limit)\n\nPlease try again with a lower amount or clear pending dues.` 
              },
              { status: 400 }
            );
          }
        }
      }
    } catch (error) {
      // Suppressed verbose warning in production
    }

    // Auto-fill default values from card if not provided
    let finalPosType = pos_type;
    let finalTaxRate = tax_rate;
    let finalMdrRate = mdr_amount;
    let finalCardName = card_name;
    
    if (withdraw > 0 && card_number && (!finalPosType || !finalTaxRate || !finalMdrRate || !finalCardName)) {
      try {
        // Get card details to check for default values
        const { rows: cardDetails } = await query(
          "SELECT enable_defaults, default_pos_type, default_tax_rate, default_mdr_rate, card_name FROM card_details WHERE REPLACE(card_number, ' ' , '') = REPLACE($1, ' ' , '')",
          [card_number]
        );
        
        if (cardDetails.length > 0 && cardDetails[0].enable_defaults) {
          const card = cardDetails[0];
          
          // Auto-fill POS type if not provided
          if (!finalPosType && card.default_pos_type) {
            finalPosType = card.default_pos_type;
          }
          
          // Auto-fill Tax rate if not provided
          if (!finalTaxRate && card.default_tax_rate !== null && card.default_tax_rate !== undefined) {
            finalTaxRate = card.default_tax_rate;
          }
          
          // Auto-fill MDR rate if not provided
          if (!finalMdrRate && card.default_mdr_rate !== null && card.default_mdr_rate !== undefined) {
            finalMdrRate = card.default_mdr_rate;
          }
        }
        // Fill card_name from card_details if missing
        if (!finalCardName && cardDetails.length > 0 && cardDetails[0].card_name) {
          finalCardName = cardDetails[0].card_name;
        }
      } catch (error) {
        // Suppressed verbose warning in production
      }
    }

    // Calculate tax amount, MDR charge amount, and profit amount if not provided
    let finalTaxAmount = taxAmountNumInput ?? undefined;
    let finalMdrChargeAmount = mdrChargeNumInput ?? undefined;
    let finalProfitAmount = profitNumInput ?? undefined;

    if (withdraw > 0 && finalPosType && finalTaxRate && finalMdrRate) {
      // Calculate Tax Amount: (Tax Rate % × Withdraw Amount) / 100
      if (finalTaxAmount === undefined) {
        finalTaxAmount = (parseFloat(finalTaxRate as any) * withdraw) / 100;
      }
      
      // Calculate MDR Charge Amount: (MDR % × Withdraw Amount) / 100
      if (finalMdrChargeAmount === undefined) {
        finalMdrChargeAmount = (parseFloat(finalMdrRate as any) * withdraw) / 100;
      }
      
      // Calculate Profit Amount: Tax Amount - MDR Charge Amount
      if (finalProfitAmount === undefined) {
        finalProfitAmount = (finalTaxAmount || 0) - (finalMdrChargeAmount || 0);
      }
    }

    // Calculate pending amount and status if not provided
    let finalPendingAmount = pendingNumInput ?? undefined;
    let finalStatus = status;

    if (finalPendingAmount === undefined || finalStatus === undefined) {
      const taxAmountCalc = Number(finalTaxAmount || 0);
      const addTax = addTaxBool || false;
      
      let pending = 0;
      if (addTax) {
        // If checkbox is checked: Tax amount is added to Payable Amount
        // Pending amount = Deposit Amount - Withdraw Amount
        pending = deposit - withdraw;
      } else {
        // If checkbox is not checked: Tax amount is added to Pending Amount
        // Pending amount = (Deposit Amount - Withdraw Amount) + Tax Amount
        pending = (deposit - withdraw) + taxAmountCalc;
      }
      
      // Determine status from raw pending (before clamping)
      if (pending > 0) {
        finalStatus = "Pending";
      } else if (pending < 0) {
        finalStatus = "Overpaid";
      } else {
        finalStatus = "PAID";
      }
      
      // Business rule: pending_amount must never be negative
      const clampedPending = Math.max(0, pending);
      finalPendingAmount = clampedPending;
    }

    // Ensure numeric values before insert
    const toNumberOrNull = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };
    const finalTaxRateNum = toNumberOrNull(finalTaxRate);
    const finalMdrRateNum = toNumberOrNull(finalMdrRate);
    const finalTaxAmountNum = toNumberOrNull(finalTaxAmount);
    const finalMdrChargeAmountNum = toNumberOrNull(finalMdrChargeAmount);
    const finalProfitAmountNum = toNumberOrNull(finalProfitAmount);
    const finalPendingAmountNum = toNumberOrNull(finalPendingAmount);
    
    // Insert transaction
    const insertQuery = `
      INSERT INTO transactions (
        customer_id, card_number, card_name, deposit_amount, withdraw_amount,
        payable_amount, add_tax_to_withdraw, pos_type, tax_rate, tax_amount,
        mdr_amount, mdr_charge_amount, profit_amount, pending_amount, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;
    
    const { rows } = await query(insertQuery, [
      customer_id, card_number, finalCardName, deposit, withdraw,
      payableAmountNum, addTaxBool, finalPosType, finalTaxRateNum, finalTaxAmountNum,
      finalMdrRateNum, finalMdrChargeAmountNum, finalProfitAmountNum, finalPendingAmountNum, finalStatus
    ]);

    return NextResponse.json({
      success: true,
      data: rows[0],
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    // Suppressed verbose server error logging in production
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
