"use client";
import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/admin/DataTable";
import TransactionFormModal from "@/components/admin/TransactionFormModal";
import { schemas } from "@/lib/tableSchemas";
import { useData } from "@/lib/context/DataContext";

const schema = schemas.transactions;

export default function TransactionsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [totals, setTotals] = useState({
    totalAmount: 0,
    totalTax: 0,
    totalProfit: 0,
    totalPendingAmount: 0,
    creditCount: 0,
    debitCount: 0
  });

  // Use the global data context
  const { 
    state: { transactions, loading, error }, 
    fetchTransactions, 
    invalidateCache 
  } = useData();



  // Calculate totals from transaction rows
  const calculateTotals = (transactions: any[]) => {
    return transactions.reduce((acc, transaction) => {
      const depositAmount = Number(transaction.deposit_amount) || 0;
      const withdrawAmount = Number(transaction.withdraw_amount) || 0;
      const taxAmount = Number(transaction.tax_amount) || 0;
      const profitAmount = Number(transaction.profit_amount) || 0;
      const pendingAmount = Number(transaction.pending_amount) || 0;

      // Update totals
      acc.totalAmount += depositAmount + withdrawAmount;  // Total of all amounts
      acc.totalTax += taxAmount;
      acc.totalProfit += profitAmount;
      acc.totalPendingAmount += pendingAmount;

      // Update transaction type counts based on amounts
      if (depositAmount > 0) {
        acc.creditCount++;
      }
      if (withdrawAmount > 0) {
        acc.debitCount++;
      }

      return acc;
    }, {
      totalAmount: 0,
      totalTax: 0,
      totalProfit: 0,
      totalPendingAmount: 0,
      creditCount: 0,
      debitCount: 0
    });
  };

  // Fetch transactions on mount
  useEffect(() => { 
    fetchTransactions();
  }, [fetchTransactions]);

  // Transform transactions to include customer names and calculate totals
  const rows = transactions.map((transaction: any) => ({
    ...transaction,
    customer_name: transaction.customer?.full_name || 'Unknown'
  }));

  // Calculate totals whenever transactions change
  useEffect(() => {
    const totals = calculateTotals(transactions);
    setTotals(totals);
  }, [transactions]);



  const onSubmit = async (values: Record<string, any>) => {
    try {
      console.log('Transaction onSubmit received values:', JSON.stringify(values, null, 2));
      
      // No validation needed here as it's handled in the modal

      // Always use current date/time for new transactions
      const currentDateTime = new Date().toISOString();
      
      // The values from the form are already in the correct format
      // Just ensure transaction_date is set
      const updatedValues = {
        ...values,
        transaction_date: editing ? values.transaction_date : currentDateTime
      };
      
      console.log('Final transaction values to submit:', JSON.stringify(updatedValues, null, 2));
      
      // Remove any fields that aren't in the database schema
      const cleanValues = Object.fromEntries(
        Object.entries(updatedValues).filter(([key]) => {
          // Get the field names from the schema
          const fieldNames = schema.fields.map(f => f.name);
          return fieldNames.includes(key);
        })
      );
      
      console.log('Cleaned transaction values:', JSON.stringify(cleanValues, null, 2));

      let response;
      if (editing) {
        console.log(`Updating transaction with ID: ${editing.id}`);
        response = await fetch(`/api/${schema.table}/${editing.id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(cleanValues) 
        });
      } else {
        console.log('Creating new transaction');
        response = await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(cleanValues) 
        });
      }
      
      // Check if the request was successful
      if (!response.ok) {
        const responseText = await response.text();
        console.error('Error response status:', response.status);
        console.error('Error response text:', responseText);
        
        let errorMessage = 'Failed to save transaction';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      // Successfully saved
      console.log('Transaction saved successfully');
      
      // Invalidate cache to ensure dashboard data is fresh
      invalidateCache();
      
      await fetchTransactions({ forceRefresh: true });
      setOpen(false);
      return await response.json();
    } catch (err) {
      console.error('Error saving transaction:', err);
      if (err instanceof Error) {
        alert(`Error saving transaction: ${err.message}`);
      } else {
        alert('Error saving transaction. Please try again.');
      }
      throw err;
    }
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    await fetch(`/api/${schema.table}/${row.id}`, { method: 'DELETE' });
    // Invalidate cache to ensure dashboard data is fresh
    invalidateCache();
    await fetchTransactions({ forceRefresh: true });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{schema.title}</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => { setEditing(null); setOpen(true); }}>Add New</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Total Base Amount</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totals.totalAmount)}</p>
          <div className="mt-2 text-sm text-gray-400">
            Credit: {totals.creditCount} | Debit: {totals.debitCount}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Total Tax Amount</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totals.totalTax)}</p>
          <div className="mt-2 text-sm text-gray-400">
            Avg: {formatCurrency(totals.totalTax / (transactions.length || 1))}
          </div>
        </div>



        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Total Profit</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totals.totalProfit)}</p>
          <div className="mt-2 text-sm text-gray-400">
            Avg: {formatCurrency(totals.totalProfit / (transactions.length || 1))}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Total Pending Amount</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totals.totalPendingAmount)}</p>
          <div className="mt-2 text-sm text-gray-400">
            Base amounts only (tax paid immediately)
          </div>
        </div>
      </div>



      <DataTable data={rows} columns={schema.listColumns as any} onEdit={(r)=>{setEditing(r); setOpen(true);}} onDelete={onDelete} showActions={false} />
      <TransactionFormModal 
        open={open} 
        onClose={()=>setOpen(false)} 
        initial={editing} 
        onSubmit={onSubmit} 
        title={editing?`Edit ${schema.title}`:`Add ${schema.title}`} 
      />
    </div>
  );
}


