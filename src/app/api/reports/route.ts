import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(request: NextRequest) {
  try {
    const { fromDate, toDate } = await request.json();
    
    console.log('Reports API called with:', { fromDate, toDate });
    
    if (!fromDate || !toDate) {
      console.error('Missing required parameters:', { fromDate, toDate });
      return NextResponse.json(
        { error: 'From date and to date are required' },
        { status: 400 }
      );
    }

    console.log('Using PostgreSQL database');

    // Get all report data in parallel
    console.log('Starting parallel data fetching...');
    const [
      transactionReports,
      financialSummaries,
      customerAnalytics,
      agingRiskAnalysis,
      trendsComparison,
      businessHealth
    ] = await Promise.all([
      getTransactionReports(query, fromDate, toDate),
      getFinancialSummaries(query, fromDate, toDate),
      getCustomerAnalytics(query, fromDate, toDate),
      getAgingRiskAnalysis(query, fromDate, toDate),
      getTrendsComparison(query, fromDate, toDate),
      getBusinessHealth(query, fromDate, toDate)
    ]);

    console.log('All data fetched successfully');
    console.log('Transaction reports count:', transactionReports?.highValueTransactions?.length || 0);
    console.log('Financial summaries total received:', financialSummaries?.totalReceived || 0);
    console.log('Customer analytics data:', customerAnalytics);
    console.log('Customer analytics customersByCity:', customerAnalytics?.customersByCity?.length || 0);

    return NextResponse.json({
      transactionReports,
      financialSummaries,
      customerAnalytics,
      agingRiskAnalysis,
      trendsComparison,
      businessHealth
    });

  } catch (error) {
    console.error('Error generating reports:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to generate reports', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function getTransactionReports(query: any, fromDate: string, toDate: string) {
  try {
    console.log('Transaction Reports - Date range:', { fromDate, toDate });
    
    // Get transactions within the specified date range
    const transactionsResult = await query(
      'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
      [fromDate, toDate]
    );
    const allTransactions = transactionsResult.rows || [];
    console.log('Filtered transactions count:', allTransactions.length);

    // Get all accounts for payment status analysis (accounts don't need date filtering)
    const accountsResult = await query('SELECT * FROM accounts');
    const accounts = accountsResult.rows || [];

    // Get all customers for transaction analysis (customers don't need date filtering)
    const customersResult = await query('SELECT * FROM customers');
    const customers = customersResult.rows || [];

    // Payment Status Distribution (Pending vs Paid) = Paid = total deposits, Pending = total pending amounts
    const totalDepositAmount = allTransactions?.reduce((sum: number, transaction: any) => 
      sum + (parseFloat(transaction.deposit_amount) || 0), 0) || 0;
    const totalPendingAmount = allTransactions?.reduce((sum: number, transaction: any) => 
      sum + (parseFloat(transaction.pending_amount) || 0), 0) || 0;

    console.log('Payment Status Distribution:', { 
      totalDepositAmount: Math.floor(totalDepositAmount), 
      totalPendingAmount: Math.floor(totalPendingAmount) 
    });

    const paymentStatusDistribution = [
      { payment_status: 'Paid', amount: Math.floor(totalDepositAmount) },
      { payment_status: 'Pending', amount: Math.floor(totalPendingAmount) }
    ].filter(item => item.amount > 0); // Only include items with values > 0

    // MDR vs TAX Distribution = calculate total MDR amounts vs total Tax amounts from all transactions
    const totalMDRAmount = allTransactions?.reduce((sum: number, transaction: any) => 
      sum + (parseFloat(transaction.mdr_charge_amount) || 0), 0) || 0;
    const totalTaxAmount = allTransactions?.reduce((sum: number, transaction: any) => 
      sum + (parseFloat(transaction.tax_amount) || 0), 0) || 0;

    console.log('MDR vs TAX calculation:', { totalMDRAmount, totalTaxAmount });

    const mdrVsTaxDistribution = [
      { name: 'MDR Amount', value: Math.floor(totalMDRAmount) },
      { name: 'Tax Amount', value: Math.floor(totalTaxAmount) }
    ].filter(item => item.value > 0); // Only include items with values > 0

    // High Value Transactions (Top 10) = Total Transactions
    const highValueTransactions = allTransactions
      ?.sort((a: any, b: any) => (b.deposit_amount || 0) - (a.deposit_amount || 0))
      .slice(0, 10)
      .map((transaction: any) => ({
        id: transaction.id,
        amount: transaction.deposit_amount || transaction.withdraw_amount || 0,
        status: transaction.deposit_amount > 0 ? 'Deposit' : 'Withdraw',
        created_at: transaction.transaction_date,
        customer_id: transaction.customer_id
      })) || [];

    // Add customer names to high value transactions
    const customerNamesMap = new Map(customers.map((c: any) => [c.id, c.full_name]));
    highValueTransactions.forEach((transaction: any) => {
      transaction.customer_name = customerNamesMap.get(transaction.customer_id);
    });

    return {
      paymentStatusDistribution,
      mdrVsTaxDistribution,
      highValueTransactions
    };
  } catch (error) {
    console.error('Error fetching transaction reports:', error);
    return {
      paymentStatusDistribution: [],
      mdrVsTaxDistribution: [],
      highValueTransactions: []
    };
  }
}

async function getFinancialSummaries(query: any, fromDate: string, toDate: string) {
  try {
    console.log('Financial Summaries - Date range:', { fromDate, toDate });
    
    // Get all accounts data (accounts don't need date filtering)
    const accountsResult = await query('SELECT * FROM accounts');
    const accounts = accountsResult.rows || [];

    // Get transactions within the specified date range
    const transactionsResult = await query(
      'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
      [fromDate, toDate]
    );
    const transactions = transactionsResult.rows || [];
    console.log('Financial Summaries - Filtered transactions count:', transactions.length);

    // Get cards created within the specified date range
    // Using created_at ensures "New Cards Distribution" reflects newly added cards
    const cardsResult = await query(
      'SELECT * FROM card_details WHERE created_at >= $1 AND created_at <= $2',
      [fromDate, toDate]
    );
    const cards = cardsResult.rows || [];
    console.log('Financial Summaries - Filtered cards count:', cards.length);

    // Total Received = Total Deposit
    const totalReceived = transactions?.reduce((sum: number, transaction: any) => {
      const amount = parseFloat(transaction.deposit_amount) || 0;
      return sum + amount;
    }, 0) || 0;

    // Pending Amount = total pending amount
    const totalPendingAmount = transactions?.reduce((sum: number, transaction: any) => {
      const amount = parseFloat(transaction.pending_amount) || 0;
      return sum + amount;
    }, 0) || 0;

    // Credit Limits = total credit given
    const totalCreditLimits = accounts?.reduce((sum: number, account: any) => {
      const amount = parseFloat(account.credit_limit) || 0;
      return sum + amount;
    }, 0) || 0;

    // Net Position = total profits
    const totalProfits = transactions?.reduce((sum: number, transaction: any) => {
      const amount = parseFloat(transaction.profit_amount) || 0;
      return sum + amount;
    }, 0) || 0;

    // New Cards Distribution = use bar chart to display the total of New Credit, as Debit Cards added
    const debitCardsCount = cards?.filter((card: any) => 
      card.card_type && card.card_type.toLowerCase().includes('debit')
    ).length || 0;
    
    const creditCardsCount = cards?.filter((card: any) => 
      card.card_type && card.card_type.toLowerCase().includes('credit')
    ).length || 0;
    
    const newCardsDistribution = [
      { name: 'Debit Cards', value: debitCardsCount },
      { name: 'Credit Cards', value: creditCardsCount }
    ];

    // Bank Distribution = group cards by bank name for pie chart
    const bankDistribution = cards?.reduce((acc: any, card: any) => {
      const bankName = card.bank_name?.trim() || 'Unknown Bank';
      acc[bankName] = (acc[bankName] || 0) + 1;
      return acc;
    }, {}) || {};

    const bankDistributionArray = Object.entries(bankDistribution).map(([bank, count]) => ({
      name: bank,
      value: count as number
    })).sort((a, b) => (b.value as number) - (a.value as number)); // Sort by count descending

    // Transaction Overview (Deposits vs Withdrawals vs Pending) = Total of Deposits, Withdrawals & Pending Amount
    const totalDeposits = transactions?.reduce((sum: number, transaction: any) => {
      const amount = parseFloat(transaction.deposit_amount) || 0;
      return sum + amount;
    }, 0) || 0;
    const totalWithdrawals = transactions?.reduce((sum: number, transaction: any) => {
      const amount = parseFloat(transaction.withdraw_amount) || 0;
      return sum + amount;
    }, 0) || 0;

    const transactionOverview = [
      { name: 'Deposits', value: Math.floor(totalDeposits) },
      { name: 'Withdrawals', value: Math.floor(totalWithdrawals) },
      { name: 'Pending', value: Math.floor(totalPendingAmount) }
    ];

    return {
      totalReceived,
      totalPendingAmount,
      totalCreditLimits,
      netPosition: totalProfits,
      newCardsDistribution,
      bankDistribution: bankDistributionArray,
      transactionOverview
    };
  } catch (error) {
    console.error('Error fetching financial summaries:', error);
    return {
      totalReceived: 0,
      totalPendingAmount: 0,
      totalCreditLimits: 0,
      netPosition: 0,
      newCardsDistribution: [],
      bankDistribution: [],
      transactionOverview: []
    };
  }
}

async function getCustomerAnalytics(query: any, fromDate: string, toDate: string) {
  try {
    console.log('=== Customer Analytics Debug ===');
    console.log('Date range:', { fromDate, toDate });
    
    // Get all customers first
    const customersResult = await query('SELECT * FROM customers');
    const allCustomers = customersResult.rows || [];
    
    if (!allCustomers || allCustomers.length === 0) {
      console.log('No customers found in database');
      return {
        customersByCity: [],
        topCustomers: [],
        customerOutstanding: []
      };
    }
    
    console.log('Processing customers:', allCustomers.length);

    // Process customer distribution by city (this is working)
    const customersByCity = allCustomers?.reduce((acc: any, customer: any) => {
      const city = customer.city?.trim() || 'Unknown';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {}) || {};

    const customersByCityArray = Object.entries(customersByCity)
      .map(([city, count]) => ({
        name: city,
        value: count
      }))
      .sort((a, b) => (b as any).value - (a as any).value);

    console.log('City data processed successfully:', customersByCityArray.length, 'cities');

    // Try to get additional data safely
    let topCustomers = [];
    let customerOutstanding = [];

    try {
      // Get transactions within the specified date range for top customers calculation
      const transactionsResult = await query(
        'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
        [fromDate, toDate]
      );
      const transactions = transactionsResult.rows || [];
      console.log('Customer Analytics - Filtered transactions count:', transactions.length);

      // Process top customers by net deposits (only positive net deposits for meaningful ranking)
      const customerSettlements = allCustomers?.map((customer: any) => {
        const customerTransactions = transactions?.filter((t: any) => t.customer_id === customer.id) || [];
        const totalDeposits = customerTransactions?.reduce((sum: number, transaction: any) => {
          return sum + (parseFloat(transaction.deposit_amount) || 0);
        }, 0) || 0;
        const totalWithdrawals = customerTransactions?.reduce((sum: number, transaction: any) => {
          return sum + (parseFloat(transaction.withdraw_amount) || 0);
        }, 0) || 0;
        
        // Calculate net deposits (positive indicates customer has net contributed)
        const netDeposits = totalDeposits - totalWithdrawals;
        
        return {
          ...customer,
          totalSettlement: Math.max(0, Math.floor(netDeposits)), // Only show positive net deposits
          totalDeposits: Math.floor(totalDeposits),
          totalWithdrawals: Math.floor(totalWithdrawals),
          netDeposits: Math.floor(netDeposits) // Keep original for reference
        };
      })
      .filter((customer: any) => customer.totalDeposits > 0) // Only include customers with actual deposits
      .sort((a: any, b: any) => b.totalSettlement - a.totalSettlement)
      .slice(0, 10) || [];

      topCustomers = customerSettlements;
      console.log('Top customers processed:', topCustomers.length);

    } catch (topCustomersError) {
      console.error('Error processing top customers:', topCustomersError);
      topCustomers = [];
    }

    try {
      // Get accounts data for outstanding calculation
      const accountsResult = await query('SELECT * FROM accounts');
      const accounts = accountsResult.rows || [];

      customerOutstanding = allCustomers?.map((customer: any) => {
        const customerAccount = accounts?.find((a: any) => a.customer_id === customer.id);
        const totalAmount = (customerAccount?.received || 0) + (customerAccount?.pending_amount || 0);
        const outstandingAmount = customerAccount?.pending_amount || 0;
        
        return {
          id: customer.id,
          name: customer.full_name,
          city: customer.city,
          state: customer.state,
          totalAmount,
          outstandingAmount
        };
      }) || [];

      console.log('Customer outstanding processed:', customerOutstanding.length);

    } catch (outstandingError) {
      console.error('Error processing customer outstanding:', outstandingError);
      customerOutstanding = [];
    }

    console.log('Customer Analytics Results:');
    console.log('- Customers by City:', customersByCityArray.length);
    console.log('- Top Customers:', topCustomers.length);
    console.log('- Customer Outstanding:', customerOutstanding.length);

    return {
      customersByCity: customersByCityArray,
      topCustomers: topCustomers,
      customerOutstanding: customerOutstanding
    };

  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');
    return {
      customersByCity: [],
      topCustomers: [],
      customerOutstanding: []
    };
  }
}

async function getAgingRiskAnalysis(query: any, fromDate: string, toDate: string) {
  try {
    console.log('Aging Risk Analysis - Date range:', { fromDate, toDate });
    const now = new Date();

    // Get transactions within the specified date range for aging analysis
    const transactionsResult = await query(
      'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
      [fromDate, toDate]
    );
    const transactions = transactionsResult.rows || [];
    
    console.log('Aging Risk Analysis - Filtered transactions count:', transactions.length);

    // Initialize aging buckets for pending amounts (overdue)
    let bucket0to30 = 0;    // Recent Overdue (0–30 Days)
    let bucket31to60 = 0;   // Medium Term (31–60 Days)
    let bucket61to90 = 0;   // Long Term (61–90 Days)
    let bucket90Plus = 0;   // Critical Overdue (90+ Days)

    // Process each transaction for aging analysis
    transactions?.forEach((transaction: any) => {
      const transactionDate = new Date(transaction.transaction_date);
      const daysSinceTransaction = Math.floor((now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get pending amount for this transaction (overdue amount)
      const pendingAmount = parseFloat(transaction.pending_amount) || 0;
      
      // Only count transactions with pending amounts (overdue amounts)
      if (pendingAmount > 0) {
        if (daysSinceTransaction <= 30) {
          bucket0to30 += pendingAmount;
        } else if (daysSinceTransaction <= 60) {
          bucket31to60 += pendingAmount;
        } else if (daysSinceTransaction <= 90) {
          bucket61to90 += pendingAmount;
      } else {
          bucket90Plus += pendingAmount;
        }
      }
    });

    // Calculate total outstanding (all pending amounts/overdue amounts)
    const totalOutstanding = bucket0to30 + bucket31to60 + bucket61to90 + bucket90Plus;
    
    // Risk Score calculation: (Overdue Amount ÷ Total Outstanding) × 100
    // Overdue = 60+ days (Long Term + Critical Overdue) for better risk assessment
    const overdueAmount = bucket61to90 + bucket90Plus;
    const riskScore = totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0;

    // Credit Aging Analysis data for graph
    const creditAgingAnalysis = [
      { name: '0-30 Days', value: Math.floor(bucket0to30), days: '0-30' },
      { name: '31-60 Days', value: Math.floor(bucket31to60), days: '31-60' },
      { name: '61-90 Days', value: Math.floor(bucket61to90), days: '61-90' },
      { name: '90+ Days', value: Math.floor(bucket90Plus), days: '90+' }
    ];

    console.log('Credit Aging Analysis Results:');
    console.log('- 0-30 Days:', bucket0to30);
    console.log('- 31-60 Days:', bucket31to60);
    console.log('- 61-90 Days:', bucket61to90);
    console.log('- 90+ Days:', bucket90Plus);
    console.log('- Risk Score:', riskScore.toFixed(2) + '%');

    return {
      bucket0to30: Math.floor(bucket0to30),
      bucket31to60: Math.floor(bucket31to60),
      bucket61to90: Math.floor(bucket61to90),
      bucket90Plus: Math.floor(bucket90Plus),
      riskScore: Math.floor(riskScore * 100) / 100, // Round to 2 decimal places
      totalOutstanding: Math.floor(totalOutstanding),
      overdueAmount: Math.floor(overdueAmount),
      creditAgingAnalysis
    };
  } catch (error) {
    console.error('Error fetching aging risk analysis:', error);
    return {
      bucket0to30: 0,
      bucket31to60: 0,
      bucket61to90: 0,
      bucket90Plus: 0,
      riskScore: 0,
      totalOutstanding: 0,
      overdueAmount: 0,
      creditAgingAnalysis: []
    };
  }
}

async function getTrendsComparison(query: any, fromDate: string, toDate: string) {
  try {
    console.log('Trends Comparison - Date range:', { fromDate, toDate });
    
    // Get transactions within the specified date range for trends analysis
    const transactionsResult = await query(
      'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
      [fromDate, toDate]
    );
    const transactions = transactionsResult.rows || [];
    
    console.log('Trends Comparison - Filtered transactions count:', transactions.length);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based (0 = January, 11 = December)

    // Helper function to calculate transaction amount for a specific month/year
    const getTransactionAmountForMonth = (year: number, month: number) => {
      return transactions?.reduce((sum: number, transaction: any) => {
        const transactionDate = new Date(transaction.transaction_date);
        const transactionYear = transactionDate.getFullYear();
        const transactionMonth = transactionDate.getMonth();
        
        // Check if transaction is in the specified month/year
        if (transactionYear === year && transactionMonth === month) {
          const depositAmount = parseFloat(transaction.deposit_amount) || 0;
          const withdrawAmount = parseFloat(transaction.withdraw_amount) || 0;
          return sum + depositAmount + withdrawAmount; // Total transaction amount
        }
        return sum;
      }, 0) || 0;
    };

    // Current Month = Total Transactions Amount of current month
    const currentMonthTotal = getTransactionAmountForMonth(currentYear, currentMonth);

    // Last Month = Total Transactions Amount of Last Month
    let lastMonthYear = currentYear;
    let lastMonth = currentMonth - 1;
    if (lastMonth < 0) {
      lastMonth = 11; // December
      lastMonthYear = currentYear - 1;
    }
    const lastMonthTotal = getTransactionAmountForMonth(lastMonthYear, lastMonth);

    // Same Month Last Year = Total Transactions Amount of Last Year of same month
    const lastYearTotal = getTransactionAmountForMonth(currentYear - 1, currentMonth);

    // Calculate percentage changes
    const monthOverMonth = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
    const yearOverYear = lastYearTotal > 0 ? ((currentMonthTotal - lastYearTotal) / lastYearTotal) * 100 : 0;

    console.log('Trends Comparison Results:');
    console.log('- Current Month (' + (currentMonth + 1) + '/' + currentYear + '):', currentMonthTotal);
    console.log('- Last Month (' + (lastMonth + 1) + '/' + lastMonthYear + '):', lastMonthTotal);
    console.log('- Same Month Last Year (' + (currentMonth + 1) + '/' + (currentYear - 1) + '):', lastYearTotal);
    console.log('- Month over Month:', monthOverMonth.toFixed(2) + '%');
    console.log('- Year over Year:', yearOverYear.toFixed(2) + '%');

    return {
      currentMonth: Math.floor(currentMonthTotal),
      lastMonth: Math.floor(lastMonthTotal),
      lastYear: Math.floor(lastYearTotal),
      monthOverMonth: Math.floor(monthOverMonth * 100) / 100, // Round to 2 decimal places
      yearOverYear: Math.floor(yearOverYear * 100) / 100 // Round to 2 decimal places
    };
  } catch (error) {
    console.error('Error fetching trends comparison:', error);
    return {
      currentMonth: 0,
      lastMonth: 0,
      lastYear: 0,
      monthOverMonth: 0,
      yearOverYear: 0
    };
  }
}

async function getBusinessHealth(query: any, fromDate: string, toDate: string) {
  try {
    console.log('Business Health - Date range:', { fromDate, toDate });
    
    // Get all customers (customers don't need date filtering for business health overview)
    const customersResult = await query('SELECT * FROM customers');
    const allCustomers = customersResult.rows || [];

    // Get all accounts (accounts don't need date filtering)
    const accountsResult = await query('SELECT * FROM accounts');
    const accounts = accountsResult.rows || [];

    // Get transactions within the specified date range
    const transactionsResult = await query(
      'SELECT * FROM transactions WHERE created_at >= $1 AND created_at <= $2',
      [fromDate, toDate]
    );
    const transactions = transactionsResult.rows || [];

    // Get cards within the specified date range using computed upcoming due date based on due_day
    const cardsResult = await query(
      `SELECT * FROM card_details WHERE (
        CASE 
          WHEN due_day IS NOT NULL THEN (
            CASE 
              WHEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              ) >= CURRENT_DATE
              THEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
              ELSE make_date(
                EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
            END
          )
          ELSE due_date
        END
      ) >= $1 AND (
        CASE 
          WHEN due_day IS NOT NULL THEN (
            CASE 
              WHEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              ) >= CURRENT_DATE
              THEN make_date(
                EXTRACT(YEAR FROM CURRENT_DATE)::int,
                EXTRACT(MONTH FROM CURRENT_DATE)::int,
                LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
              ELSE make_date(
                EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int,
                LEAST(due_day, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::int)
              )
            END
          )
          ELSE due_date
        END
      ) <= $2`,
      [fromDate, toDate]
    );
    const cards = cardsResult.rows || [];
    
    console.log('Business Health - Filtered data:', { 
      customers: allCustomers.length, 
      accounts: accounts.length,
      transactions: transactions.length,
      cards: cards.length 
    });

    // Active customers (customers with any action: cards, transactions, or paid pending amounts)
    const activeCustomerIds = new Set([
      ...(accounts?.map((a: any) => a.customer_id) || []),
      ...(transactions?.map((t: any) => t.customer_id) || []),
      ...(cards?.map((c: any) => c.customer_id) || [])
    ]);
    const activeCustomers = allCustomers?.filter((c: any) => activeCustomerIds.has(c.id)) || [];

    // New customers (customers created in the period)
    const newCustomers = allCustomers?.filter((c: any) => {
      const createdDate = new Date(c.created_at);
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);
      return createdDate >= fromDateObj && createdDate <= toDateObj;
    }) || [];

    // New cards (cards added in the period) - Collection Efficiency renamed to New Cards
    const newCards = cards?.filter((card: any) => {
      // Since card_details doesn't have created_at, we'll use a different approach
      // We'll count all cards as "new cards" for now, or you can add created_at to card_details table
      return true; // For now, count all cards as new cards
    }) || [];

    return {
      activeCustomers: activeCustomers.length,
      newCustomers: newCustomers.length,
      newCards: newCards.length
    };
  } catch (error) {
    console.error('Error fetching business health:', error);
    return {
      activeCustomers: 0,
      newCustomers: 0,
      newCards: 0
    };
  }
}
