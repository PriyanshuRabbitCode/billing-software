"use client";
import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/admin/DataTable";
import TransactionFormModal from "@/components/admin/TransactionFormModal";
import { schemas } from "@/lib/tableSchemas";
import { useData } from "@/lib/context/DataContext";
import { useToastHelpers } from "@/components/ui/Toast";

const schema = schemas.transactions;

export default function TransactionsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { 
    state: { transactions, loading, error }, 
    fetchTransactions, 
    invalidateCache 
  } = useData();

  const { success, error: showError } = useToastHelpers();

  // Trigger initial fetch of transactions on mount
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Transform transactions to include customer names and calculate totals
  const rows = transactions.map((transaction: any) => ({
    ...transaction,
    customer_name: transaction.customer?.full_name || 'Unknown'
  }));

  // Calculate totals whenever transactions change
  const [totals, setTotals] = useState<{ deposit: number; withdraw: number; payable: number }>({ deposit: 0, withdraw: 0, payable: 0 });
  const calculateTotals = useCallback((txs: any[]) => {
    return txs.reduce((acc, tx) => {
      acc.deposit += Number(tx.deposit_amount || 0);
      acc.withdraw += Number(tx.withdraw_amount || 0);
      acc.payable += Number(tx.payable_amount || 0);
      return acc;
    }, { deposit: 0, withdraw: 0, payable: 0 });
  }, []);

  useEffect(() => {
    const totals = calculateTotals(transactions);
    setTotals(totals);
  }, [transactions, calculateTotals]);

  const sanitizeTransactionPayload = (values: Record<string, any>) => {
    const numericFields = [
      'deposit_amount', 'withdraw_amount', 'payable_amount', 'tax_rate', 'tax_amount', 'mdr_amount', 'mdr_charge_amount', 'profit_amount', 'pending_amount'
    ];
    const v: Record<string, any> = { ...values };
    for (const f of numericFields) {
      if (v[f] === '' || v[f] === undefined) v[f] = null;
      else if (v[f] !== null) v[f] = Number(v[f]);
    }
    if (v.customer_id) v.customer_id = Number(v.customer_id);
    return v;
  };

  const onSubmit = async (values: Record<string, any>) => {
    try {
      const currentDateTime = new Date().toISOString();
      const updatedValues = {
        ...values,
        transaction_date: editing ? values.transaction_date : currentDateTime
      };
      const cleanValues = Object.fromEntries(
        Object.entries(updatedValues).filter(([key]) => {
          const fieldNames = schema.fields.map(f => f.name);
          return fieldNames.includes(key);
        })
      );
      const payload = sanitizeTransactionPayload(cleanValues);

      let response;
      if (editing) {
        response = await fetch(`/api/${schema.table}/${editing.id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
      } else {
        response = await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
      }

      if (!response.ok) {
        let errorMessage = 'Failed to save transaction';
        try {
          // Read the body ONCE as text to avoid "body stream already read" errors
          const raw = await response.text();
          if (raw) {
            // Try to parse JSON from the raw text
            try {
              const data = JSON.parse(raw);
              errorMessage = (data && (data.error || data.message)) || errorMessage;
            } catch {
              // Not JSON: derive a meaningful message from raw text or status
              if (raw.includes('<html') || raw.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else {
                errorMessage = raw.substring(0, 200) + '...';
              }
            }
          } else {
            errorMessage = response.statusText || `HTTP ${response.status}`;
          }
        } catch {
          errorMessage = response.statusText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Success path without parsing body again to avoid body stream issues
      try {
        invalidateCache();
        await fetchTransactions({ forceRefresh: true });
      } catch (refreshErr) {
        // Swallow refresh errors to avoid surfacing as modal alerts; log for debugging
        console.error('Post-save refresh failed:', refreshErr);
      }
      setOpen(false);
      success('Transaction saved successfully');
      return;
    } catch (err) {
      // Re-throw to let the modal handle error display and keep the form open
      if (err instanceof Error) {
        throw err;
      } else {
        throw new Error('Failed to save transaction.');
      }
    }
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    try {
      const res = await fetch(`/api/${schema.table}/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        let errorMessage = 'Delete failed';
        try {
          // Read the body ONCE as text to avoid "body stream already read" errors
          const raw = await res.text();
          if (raw) {
            try {
              const data = JSON.parse(raw);
              errorMessage = (data && (data.error || data.message)) || errorMessage;
            } catch {
              if (raw.includes('<html') || raw.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else {
                errorMessage = raw.substring(0, 200) + '...';
              }
            }
          } else {
            errorMessage = res.statusText || `HTTP ${res.status}`;
          }
        } catch {
          errorMessage = res.statusText || `HTTP ${res.status}`;
        }
        throw new Error(errorMessage);
      }
      invalidateCache();
      await fetchTransactions({ forceRefresh: true });
      success('Transaction deleted successfully.');
    } catch (error) {
      if (error instanceof Error) {
        showError('Failed to delete transaction.', error.message);
      } else {
        showError('Failed to delete transaction.');
      }
    }
  };

  if (error.transactions) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{schema.title}</h1>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Transactions</h2>
          <p className="text-red-300 mb-4">{error.transactions}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{schema.title}</h1>
        <div className="flex gap-2">
          <button 
            className="px-3 py-2 rounded bg-blue-600 text-white" 
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            New Transaction
          </button>
        </div>
      </div>

      {loading.transactions && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading transactions...</span>
        </div>
      )}

      {!loading.transactions && (
        <DataTable 
          data={rows} 
          columns={schema.listColumns as any} 
          showActions={false}
        />
      )}

      <TransactionFormModal 
        open={open} 
        onClose={() => setOpen(false)} 
        initial={editing} 
        onSubmit={onSubmit} 
        title={editing ? `Edit ${schema.title}` : `Add ${schema.title}`} 
      />
    </div>
  );
}


