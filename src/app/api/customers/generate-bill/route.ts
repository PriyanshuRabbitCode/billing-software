import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
  try {
    const {
      customerId,
      customerData,
      accounts,
      cards,
      transactions,
      taxDetails,
      identityDocuments,
      cardPendingAmounts
    } = await request.json();

    if (!customerData) {
      return NextResponse.json(
        { error: 'Customer data is required' },
        { status: 400 }
      );
    }

    // Calculate totals from transactions (primary source of truth)
    const totalDeposits = transactions?.reduce((sum: number, transaction: any) => sum + (parseFloat(transaction.deposit_amount) || 0), 0) || 0;
    const totalWithdrawals = transactions?.reduce((sum: number, transaction: any) => sum + (parseFloat(transaction.withdraw_amount) || 0), 0) || 0;
    const totalPayableAmounts = transactions?.reduce((sum: number, transaction: any) => sum + (parseFloat(transaction.payable_amount) || 0), 0) || 0;
    const totalPendingFromTransactions = transactions?.reduce((sum: number, transaction: any) => sum + (parseFloat(transaction.pending_amount) || 0), 0) || 0;
    
    // Calculate received amount as total deposits minus current pending
    const totalReceived = totalDeposits - Math.max(0, totalPendingFromTransactions);
    const totalPending = Math.max(0, totalPendingFromTransactions);
    
    // Calculate totals from accounts (fallback/additional info)
    const totalCreditLimit = accounts?.reduce((sum: number, account: any) => sum + (parseFloat(account.credit_limit) || 0), 0) || 0;
    
    // Total transactions should be total of payable amounts
    const totalTransactions = totalPayableAmounts;
    
    // Calculate net balance
    const netBalance = totalReceived - totalPending;

    // Derive credit allowed (true if any account allows credit)
    const creditAllowed = Array.isArray(accounts) ? accounts.some((a: any) => !!a.credit_allowed) : false;

    // Helper function to format currency without decimals
    const formatCurrency = (amount: number) => {
      return `₹${Math.round(amount).toLocaleString()}`;
    };

    // Generate bill HTML
    const billHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bill - ${customerData.full_name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: white;
            color: #333;
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 3px solid #2563eb; 
            padding-bottom: 20px; 
          }
          .header h1 { 
            color: #2563eb; 
            margin: 0; 
            font-size: 28px;
          }
          .header p { 
            color: #666; 
            margin: 5px 0; 
            font-size: 14px;
          }
          .bill-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
          }
          .bill-info div {
            flex: 1;
          }
          .bill-info h3 {
            margin: 0 0 10px 0;
            color: #2563eb;
            font-size: 16px;
          }
          .bill-info p {
            margin: 2px 0;
            font-size: 14px;
          }
          .section { 
            margin: 25px 0; 
            page-break-inside: avoid;
          }
          .section h2 { 
            color: #2563eb; 
            border-bottom: 2px solid #e5e7eb; 
            padding-bottom: 8px; 
            margin-bottom: 15px;
            font-size: 20px;
          }
          .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 15px; 
            margin: 20px 0; 
          }
          .summary-item { 
            background: #f8fafc; 
            padding: 15px; 
            border-radius: 8px; 
            border-left: 4px solid #2563eb;
          }
          .summary-item h3 { 
            margin: 0 0 8px 0; 
            color: #374151; 
            font-size: 14px;
          }
          .summary-item p { 
            margin: 0; 
            font-size: 18px; 
            font-weight: bold; 
            color: #2563eb; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0; 
            background: white;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 12px 8px; 
            text-align: left; 
            font-size: 14px;
          }
          th { 
            background-color: #f3f4f6; 
            font-weight: bold; 
            color: #374151;
          }
          .amount {
            text-align: right;
            font-weight: bold;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          .total-section {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .total-section h3 {
            color: #2563eb;
            margin: 0 0 10px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-weight: bold;
          }
          .grand-total {
            border-top: 2px solid #2563eb;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 18px;
            color: #2563eb;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BILLING STATEMENT</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Bill Period: ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="bill-info">
          <div>
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${customerData.full_name || '—'}</p>
            <p><strong>Email:</strong> ${customerData.email_id || '—'}</p>
            <p><strong>Phone:</strong> ${customerData.contact_no || '—'}</p>
            <p><strong>Address:</strong> ${customerData.billing_address || '—'}</p>
            <p><strong>City:</strong> ${customerData.city || '—'}, ${customerData.state || '—'}</p>
            <p><strong>PIN Code:</strong> ${customerData.pin_code || '—'}</p>
          </div>
          <div>
            <h3>Account Summary</h3>
            <p><strong>Total Received:</strong> ${formatCurrency(totalReceived)}</p>
            <p><strong>Total Pending:</strong> ${formatCurrency(totalPending)}</p>
            <p><strong>Credit Limit:</strong> ${formatCurrency(totalCreditLimit)}</p>
            <p><strong>Total Deposits:</strong> ${formatCurrency(totalDeposits)}</p>
            <p><strong>Total Withdrawals:</strong> ${formatCurrency(totalWithdrawals)}</p>
            <p><strong>Total Transactions:</strong> ${formatCurrency(totalTransactions)}</p>
            <p><strong>Net Balance:</strong> ${formatCurrency(netBalance)}</p>
          </div>
        </div>

        <div class="section">
          <h2>Account Details</h2>
          <table>
            <thead>
              <tr>
                <th>Received Amount</th>
                <th>Pending Amount</th>
                <th>Credit Limit</th>
                <th>Credit Allowed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="amount">${formatCurrency(totalDeposits)}</td>
                <td class="amount">${formatCurrency(totalPending)}</td>
                <td class="amount">${formatCurrency(totalCreditLimit)}</td>
                <td>${creditAllowed ? 'Yes' : 'No'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${cards && cards.length > 0 ? `
        <div class="section">
          <h2>Card Details</h2>
          <table>
            <thead>
              <tr>
                <th>Card Name</th>
                <th>Card Type</th>
                <th>Bank Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${cards.map((card: any) => `
                <tr>
                  <td>${card.card_name || '—'}</td>
                  <td>${card.card_type || '—'}</td>
                  <td>${card.bank_name || '—'}</td>
                  <td>Active</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${taxDetails && taxDetails.length > 0 ? `
        <div class="section">
          <h2>Tax Information</h2>
          <table>
            <thead>
              <tr>
                <th>PAN Number</th>
                <th>Aadhaar Number</th>
              </tr>
            </thead>
            <tbody>
              ${taxDetails.map((tax: any) => `
                <tr>
                  <td>${tax.pan_no || '—'}</td>
                  <td>${tax.aadhaar_no || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${transactions && transactions.length > 0 ? `
        <div class="section">
          <h2>Transaction History</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Card Number</th>
                <th>Card Name</th>
                <th>Deposit</th>
                <th>Withdraw</th>
                <th>Payable</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map((transaction: any) => `
                <tr>
                  <td>${new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString()}</td>
                  <td>${transaction.card_number ? `**** **** **** ${transaction.card_number.slice(-4)}` : '—'}</td>
                  <td>${transaction.card_name || '—'}</td>
                  <td class="amount">${formatCurrency(transaction.deposit_amount || 0)}</td>
                  <td class="amount">${formatCurrency(transaction.withdraw_amount || 0)}</td>
                  <td class="amount">${formatCurrency(transaction.payable_amount || 0)}</td>
                  <td>${transaction.status || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${cardPendingAmounts && cardPendingAmounts.length > 0 ? `
        <div class="section">
          <h2>Pending Payments</h2>
          <table>
            <thead>
              <tr>
                <th>Card Number</th>
                <th>Card Name</th>
                <th>Pending Amount</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${cardPendingAmounts.map((cardPending: any) => {
                // Find the matching card from cards array to get the due date
                const matchingCard = cards?.find((c: any) => c.card_number === cardPending.card_number);
                const dueDate = matchingCard?.due_date ? new Date(matchingCard.due_date).toLocaleDateString() : '—';
                
                return `
                <tr>
                  <td>${cardPending.card_number ? `**** **** **** ${cardPending.card_number.slice(-4)}` : '—'}</td>
                  <td>${cardPending.card_name || '—'}</td>
                  <td class="amount">${formatCurrency(cardPending.pending_amount || 0)}</td>
                  <td>${dueDate}</td>
                  <td>Pending</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="total-section">
          <h3>Bill Summary</h3>
          <div class="total-row">
            <span>Total Received Amount:</span>
            <span>${formatCurrency(totalReceived)}</span>
          </div>
          <div class="total-row">
            <span>Total Pending Amount:</span>
            <span>${formatCurrency(totalPending)}</span>
          </div>
          <div class="total-row">
            <span>Total Deposits:</span>
            <span>${formatCurrency(totalDeposits)}</span>
          </div>
          <div class="total-row">
            <span>Total Withdrawals:</span>
            <span>${formatCurrency(totalWithdrawals)}</span>
          </div>
          <div class="total-row">
            <span>Total Transactions:</span>
            <span>${formatCurrency(totalTransactions)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Net Balance:</span>
            <span>${formatCurrency(netBalance)}</span>
          </div>
        </div>


        <div class="footer">
          <p>This is a computer-generated bill. No signature required.</p>
          <p>For any queries, please contact our customer support.</p>
          <p>Generated by Billing Software on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(billHtml, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });

      await browser.close();

      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Bill_${customerData.full_name}_${new Date().toISOString().slice(0, 10)}.pdf"`
        }
      });
    } catch (error) {
      await browser.close();
      throw error;
    }

  } catch (error) {
    console.error('Error generating bill:', error);
    return NextResponse.json(
      { error: 'Failed to generate bill' },
      { status: 500 }
    );
  }
}
