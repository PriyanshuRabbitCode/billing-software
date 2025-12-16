import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
  try {
    const { format, fromDate, toDate } = await request.json();
    
    if (!format || !fromDate || !toDate) {
      return NextResponse.json(
        { error: 'Format, from date and to date are required' },
        { status: 400 }
      );
    }

    console.log('Export request:', { format, fromDate, toDate });

    // Get the same report data that the main reports API generates
    const reportData = await getReportData(fromDate, toDate);

    switch (format) {
      case 'pdf':
        return await generatePDF(reportData, fromDate, toDate);
      case 'excel':
        return await generateExcel(reportData, fromDate, toDate);
      case 'csv':
        return await generateCSV(reportData, fromDate, toDate);
      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}

async function getReportData(fromDate: string, toDate: string) {
  // Use the same logic as the main reports API to get consistent data
  console.log('Getting report data for export:', { fromDate, toDate });

  // Get transactions within the specified date range
  const transactionsResult = await query(
    'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
    [fromDate, toDate]
  );
  const transactions = transactionsResult.rows || [];

  // Get all customers
  const customersResult = await query('SELECT * FROM customers');
  const customers = customersResult.rows || [];

  // Get all accounts
  const accountsResult = await query('SELECT * FROM accounts');
  const accounts = accountsResult.rows || [];

  // Get cards created within the specified date range to align with main API
  const cardsResult = await query(
    'SELECT * FROM card_details WHERE created_at >= $1 AND created_at <= $2',
    [fromDate, toDate]
  );
  const cards = cardsResult.rows || [];

  // Bank Distribution calculation
  const bankDistribution = cards.reduce((acc: any, card: any) => {
    const bankName = card.bank_name?.trim() || 'Unknown Bank';
    acc[bankName] = (acc[bankName] || 0) + 1;
    return acc;
  }, {});

  const bankDistributionArray = Object.entries(bankDistribution).map(([bank, count]) => ({
    name: bank,
    value: count as number
  })).sort((a, b) => (b.value as number) - (a.value as number));

  // Calculate all the report metrics (same as main reports API)
  const reportMetrics = calculateReportMetrics(transactions, customers, accounts, cards);

  return {
    transactions,
    customers,
    accounts,
    cards,
    bankDistribution: bankDistributionArray,
    ...reportMetrics
  };
}

function calculateReportMetrics(transactions: any[], customers: any[], accounts: any[], cards: any[]) {
  // Payment Status Distribution (Paid vs Pending)
  const totalDepositAmount = transactions.reduce((sum, t) => sum + (parseFloat(t.deposit_amount) || 0), 0);
  const totalPendingAmount = transactions.reduce((sum, t) => sum + (parseFloat(t.pending_amount) || 0), 0);

  // MDR vs TAX Distribution
  const totalMDRAmount = transactions.reduce((sum, t) => sum + (parseFloat(t.mdr_charge_amount) || 0), 0);
  const totalTaxAmount = transactions.reduce((sum, t) => sum + (parseFloat(t.tax_amount) || 0), 0);

  // Customer Distribution by City
  const customersByCity = customers.reduce((acc: any, customer: any) => {
    const city = customer.city?.trim() || 'Unknown';
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});

  // Top Customers by Net Deposits
  const topCustomers = customers.map(customer => {
    const customerTransactions = transactions.filter(t => t.customer_id === customer.id);
    const totalDeposits = customerTransactions.reduce((sum, t) => sum + (parseFloat(t.deposit_amount) || 0), 0);
    const totalWithdrawals = customerTransactions.reduce((sum, t) => sum + (parseFloat(t.withdraw_amount) || 0), 0);
    const netDeposits = totalDeposits - totalWithdrawals;
    
    return {
      ...customer,
      totalDeposits: Math.floor(totalDeposits),
      totalWithdrawals: Math.floor(totalWithdrawals),
      netDeposits: Math.floor(netDeposits)
    };
  })
  .filter(customer => customer.totalDeposits > 0)
  .sort((a, b) => b.netDeposits - a.netDeposits)
  .slice(0, 10);

  // High Value Transactions
  const highValueTransactions = transactions
    .sort((a, b) => (parseFloat(b.deposit_amount) || 0) - (parseFloat(a.deposit_amount) || 0))
    .slice(0, 10)
    .map(transaction => {
      const customer = customers.find(c => c.id === transaction.customer_id);
      return {
        ...transaction,
        customer_name: customer?.full_name || 'Unknown'
      };
    });

  return {
    paymentStatusDistribution: [
      { payment_status: 'Paid', amount: Math.floor(totalDepositAmount) },
      { payment_status: 'Pending', amount: Math.floor(totalPendingAmount) }
    ].filter(item => item.amount > 0),
    mdrVsTaxDistribution: [
      { name: 'MDR Amount', value: Math.floor(totalMDRAmount) },
      { name: 'Tax Amount', value: Math.floor(totalTaxAmount) }
    ].filter(item => item.value > 0),
    customersByCity: Object.entries(customersByCity).map(([city, count]) => ({
      name: city,
      value: count
    })),
    topCustomers,
    highValueTransactions
  };
}

async function generatePDF(reportData: any, fromDate: string, toDate: string) {
  // Create HTML content that looks like the UI with charts represented as tables/summaries
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Billing Software - Business Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background: #f8fafc; 
          color: #1e293b; 
          line-height: 1.6; 
          padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .content { padding: 30px; }
        .section { margin-bottom: 40px; }
        .section-header { display: flex; align-items: center; margin-bottom: 20px; }
        .section-header h2 { font-size: 20px; font-weight: 600; color: #1e293b; }
        .section-header .icon { width: 20px; height: 20px; margin-right: 8px; background: #3b82f6; border-radius: 4px; }
        .grid { display: grid; gap: 20px; margin-bottom: 30px; }
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-2 { grid-template-columns: repeat(2, 1fr); }
        .card { background: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; }
        .card h3 { font-size: 14px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
        .card .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
        .chart-card { background: #f8fafc; border-radius: 8px; padding: 24px; border: 1px solid #e2e8f0; }
        .chart-title { font-size: 16px; font-weight: 600; text-align: center; margin-bottom: 16px; color: #1e293b; }
        .chart-data { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .chart-item { display: flex; align-items: center; padding: 8px 16px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; }
        .chart-dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .chart-dot.blue { background: #3b82f6; }
        .chart-dot.green { background: #10b981; }
        .chart-dot.yellow { background: #f59e0b; }
        .chart-dot.red { background: #ef4444; }
        .chart-dot.purple { background: #8b5cf6; }
        .chart-dot.pink { background: #ec4899; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px; }
        th { background: #f8fafc; color: #374151; font-weight: 600; padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
        tr:last-child td { border-bottom: none; }
        .amount { font-weight: 600; color: #059669; }
        .amount.pending { color: #dc2626; }
        .footer { text-align: center; padding: 20px; background: #f8fafc; color: #64748b; font-size: 14px; }
        @media print { body { background: white; } .container { box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="container">
      <div class="header">
          <h1>📊 Business Report</h1>
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        <p>Period: ${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}</p>
      </div>

        <div class="content">
          <!-- Business Health Snapshot -->
      <div class="section">
            <div class="section-header">
              <div class="icon"></div>
              <h2>💼 Business Health Snapshot</h2>
            </div>
            <div class="grid grid-3">
              <div class="card">
                <h3>Active Customers</h3>
                <div class="value">${reportData.customers.length}</div>
                <div class="subtitle">Total customers in system</div>
              </div>
              <div class="card">
                <h3>Total Received</h3>
                <div class="value">₹${reportData.paymentStatusDistribution.find((p: any) => p.payment_status === 'Paid')?.amount?.toLocaleString() || '0'}</div>
                <div class="subtitle">Money collected</div>
              </div>
              <div class="card">
                <h3>Total Pending</h3>
                <div class="value">₹${reportData.paymentStatusDistribution.find((p: any) => p.payment_status === 'Pending')?.amount?.toLocaleString() || '0'}</div>
                <div class="subtitle">Outstanding amount</div>
              </div>
            </div>
          </div>

          <!-- Transaction Overview -->
          <div class="section">
            <div class="section-header">
              <div class="icon"></div>
              <h2>📈 Transaction Overview</h2>
            </div>
            <div class="grid grid-2">
              <div class="chart-card">
                <div class="chart-title">Payment Status Distribution</div>
                <div class="chart-data">
                  ${reportData.paymentStatusDistribution.map((item: any, index: number) => `
                    <div class="chart-item">
                      <div class="chart-dot ${index === 0 ? 'green' : 'red'}"></div>
                      <span>${item.payment_status}: ₹${item.amount.toLocaleString()}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
              <div class="chart-card">
                <div class="chart-title">MDR vs TAX</div>
                <div class="chart-data">
                  ${reportData.mdrVsTaxDistribution.map((item: any, index: number) => `
                    <div class="chart-item">
                      <div class="chart-dot ${index === 0 ? 'blue' : 'yellow'}"></div>
                      <span>${item.name}: ₹${item.value.toLocaleString()}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

           <!-- Customer Analytics -->
           <div class="section">
             <div class="section-header">
               <div class="icon"></div>
               <h2>👥 Customer Analytics</h2>
             </div>
             <div class="grid grid-2">
               <div class="chart-card">
                 <div class="chart-title">Customer Distribution by City</div>
                 <div class="chart-data">
                   ${reportData.customersByCity.slice(0, 8).map((item: any, index: number) => `
                     <div class="chart-item">
                       <div class="chart-dot ${['blue', 'green', 'yellow', 'red', 'purple', 'pink'][index % 6]}"></div>
                       <span>${item.name}: ${item.value} customer${item.value > 1 ? 's' : ''}</span>
                     </div>
                   `).join('')}
                 </div>
          </div>
               <div class="chart-card">
                 <div class="chart-title">Top Customers by Net Deposits</div>
                 <div class="chart-data">
                   ${reportData.topCustomers.slice(0, 6).map((customer: any, index: number) => `
                     <div class="chart-item">
                       <div class="chart-dot ${['blue', 'green', 'yellow', 'red', 'purple', 'pink'][index % 6]}"></div>
                       <span>${customer.full_name?.substring(0, 15)}...: ₹${customer.netDeposits.toLocaleString()}</span>
          </div>
                   `).join('')}
          </div>
          </div>
        </div>
      </div>

           <!-- Card Details Overview -->
           ${reportData.bankDistribution && reportData.bankDistribution.length > 0 ? `
           <div class="section">
             <div class="section-header">
               <div class="icon"></div>
               <h2>💳 Card Details Overview</h2>
             </div>
             <div class="chart-card">
               <div class="chart-title">Bank Distribution</div>
               <div class="chart-data">
                 ${reportData.bankDistribution.map((item: any, index: number) => `
                   <div class="chart-item">
                     <div class="chart-dot ${['blue', 'green', 'yellow', 'red', 'purple', 'pink'][index % 6]}"></div>
                     <span>${item.name}: ${item.value} card${item.value > 1 ? 's' : ''}</span>
                   </div>
                 `).join('')}
               </div>
             </div>
           </div>
           ` : ''}

          <!-- High Value Transactions -->
          ${reportData.highValueTransactions.length > 0 ? `
      <div class="section">
            <div class="section-header">
              <div class="icon"></div>
              <h2>💰 High Value Transactions</h2>
            </div>
        <table>
          <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Deposit Amount</th>
                  <th>Card Number</th>
                  <th>Status</th>
            </tr>
          </thead>
          <tbody>
                ${reportData.highValueTransactions.map((transaction: any) => `
                  <tr>
                    <td>${new Date(transaction.created_at).toLocaleDateString()}</td>
                    <td>${transaction.customer_name}</td>
                    <td class="amount">₹${parseFloat(transaction.deposit_amount || 0).toLocaleString()}</td>
                    <td>${transaction.card_number || '-'}</td>
                    <td>${transaction.status || 'Pending'}</td>
                </tr>
                `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

          <!-- Top Customers Details -->
          ${reportData.topCustomers.length > 0 ? `
      <div class="section">
            <div class="section-header">
              <div class="icon"></div>
              <h2>🏆 Top Customers Details</h2>
            </div>
        <table>
          <thead>
            <tr>
                  <th>Customer Name</th>
              <th>City</th>
                  <th>Total Deposits</th>
                  <th>Total Withdrawals</th>
                  <th>Net Deposits</th>
            </tr>
          </thead>
          <tbody>
                ${reportData.topCustomers.map((customer: any) => `
                  <tr>
                    <td>${customer.full_name}</td>
                    <td>${customer.city || '-'}</td>
                    <td class="amount">₹${customer.totalDeposits.toLocaleString()}</td>
                    <td class="amount pending">₹${customer.totalWithdrawals.toLocaleString()}</td>
                    <td class="amount">₹${customer.netDeposits.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
          ` : ''}
      </div>

      <div class="footer">
          <p>📋 Report generated by Billing Software | ${new Date().toLocaleString()}</p>
          <p>💡 This report reflects data for the selected time period</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Launch Puppeteer to convert HTML to PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set the HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });
    
    // Generate PDF with proper formatting
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();
    
    return new NextResponse(pdfBuffer as any, {
    headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Business_Report_${formatDate(fromDate)}_${formatDate(toDate)}.pdf"`
    }
  });
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function generateExcel(reportData: any, fromDate: string, toDate: string) {
  // Create comprehensive Excel data with multiple sheets in CSV format
  const csvContent = [
    '=== BILLING SOFTWARE BUSINESS REPORT ===',
    `Generated: ${new Date().toLocaleString()}`,
    `Period: ${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`,
    '',
    '=== BUSINESS HEALTH SNAPSHOT ===',
    `Total Customers,${reportData.customers.length}`,
    `Total Received,${reportData.paymentStatusDistribution.find((p: any) => p.payment_status === 'Paid')?.amount || 0}`,
    `Total Pending,${reportData.paymentStatusDistribution.find((p: any) => p.payment_status === 'Pending')?.amount || 0}`,
    '',
    '=== PAYMENT STATUS DISTRIBUTION ===',
    'Status,Amount',
    ...reportData.paymentStatusDistribution.map((item: any) => 
      `${item.payment_status},${item.amount}`
    ),
    '',
    '=== MDR vs TAX DISTRIBUTION ===',
    'Type,Amount',
    ...reportData.mdrVsTaxDistribution.map((item: any) => 
      `${item.name},${item.value}`
    ),
    '',
     '=== CUSTOMER DISTRIBUTION BY CITY ===',
     'City,Customer Count',
     ...reportData.customersByCity.map((item: any) => 
       `${item.name},${item.value}`
     ),
     '',
     '=== BANK DISTRIBUTION ===',
     'Bank Name,Card Count',
     ...reportData.bankDistribution.map((item: any) => 
       `${item.name},${item.value}`
     ),
    '',
    '=== TOP CUSTOMERS BY NET DEPOSITS ===',
    'Customer Name,City,State,Email,Phone,Total Deposits,Total Withdrawals,Net Deposits',
    ...reportData.topCustomers.map((customer: any) => 
      `${customer.full_name},${customer.city || ''},${customer.state || ''},${customer.email_id || ''},${customer.contact_no || ''},${customer.totalDeposits},${customer.totalWithdrawals},${customer.netDeposits}`
    ),
    '',
    '=== HIGH VALUE TRANSACTIONS ===',
    'Date,Customer Name,Deposit Amount,Withdraw Amount,Card Number,Status',
    ...reportData.highValueTransactions.map((transaction: any) => 
      `${new Date(transaction.created_at).toLocaleDateString()},${transaction.customer_name},${transaction.deposit_amount || 0},${transaction.withdraw_amount || 0},${transaction.card_number || ''},${transaction.status || 'Pending'}`
    ),
    '',
    '=== ALL TRANSACTIONS (FILTERED) ===',
    'Date,Customer ID,Customer Name,Deposit Amount,Withdraw Amount,Pending Amount,Tax Amount,MDR Amount,Card Number,Status',
    ...reportData.transactions.map((transaction: any) => {
      const customer = reportData.customers.find((c: any) => c.id === transaction.customer_id);
      return `${new Date(transaction.created_at).toLocaleDateString()},${transaction.customer_id},${customer?.full_name || 'Unknown'},${transaction.deposit_amount || 0},${transaction.withdraw_amount || 0},${transaction.pending_amount || 0},${transaction.tax_amount || 0},${transaction.mdr_charge_amount || 0},${transaction.card_number || ''},${transaction.status || 'Pending'}`;
    }),
    '',
    '=== ALL CUSTOMERS ===',
    'ID,Full Name,City,State,Pin Code,Email,Phone,Created Date',
    ...reportData.customers.map((customer: any) => 
      `${customer.id},${customer.full_name},${customer.city || ''},${customer.state || ''},${customer.pin_code || ''},${customer.email_id || ''},${customer.contact_no || ''},${new Date(customer.created_at).toLocaleDateString()}`
    )
  ].join('\n');

  const buffer = Buffer.from(csvContent, 'utf-8');
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Business_Report_${formatDate(fromDate)}_${formatDate(toDate)}.xlsx"`
    }
  });
}

async function generateCSV(reportData: any, fromDate: string, toDate: string) {
  const csvContent = [
    'Customer ID,Customer Name,City,State,Email,Phone,Total Deposits,Total Withdrawals,Net Deposits,Transaction Count',
    ...reportData.topCustomers.map((customer: any) => {
      const customerTransactionCount = reportData.transactions.filter((t: any) => t.customer_id === customer.id).length;
      return `${customer.id},${customer.full_name},${customer.city || ''},${customer.state || ''},${customer.email_id || ''},${customer.contact_no || ''},${customer.totalDeposits},${customer.totalWithdrawals},${customer.netDeposits},${customerTransactionCount}`;
    })
  ].join('\n');

  const buffer = Buffer.from(csvContent, 'utf-8');
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="Customer_Report_${formatDate(fromDate)}_${formatDate(toDate)}.csv"`
    }
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}
