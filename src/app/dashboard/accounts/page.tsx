"use client";
import { useCallback, useEffect, useState } from "react";
// Use our API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CrudFormModal from "@/components/admin/CrudFormModal";
import CardPendingAmounts from "@/components/admin/CardPendingAmounts";
import { schemas } from "@/lib/tableSchemas";

const schema = schemas.accounts;

export default function AccountsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/${schema.table}`);
    const data = await res.json();
    
    // Transform the data to include customer names
    const transformedData = await Promise.all((data ?? []).map(async (row: any) => {
              try {
          const customerRes = await fetch(`/api/customers?id=${row.customer_id}`);
          const result = await customerRes.json();
          const customer = result.data[0];
          return {
            ...row,
            customer_name: customer?.full_name || 'Unknown'
          };
        } catch (err) {
          console.error('Error fetching customer:', err);
          return row;
        }
    }));
    
    setRows(transformedData);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSubmit = async (values: Record<string, any>) => {
    if (editing) {
      await fetch(`/api/${schema.table}/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    } else {
      await fetch(`/api/${schema.table}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    }
    await load();
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    await fetch(`/api/${schema.table}/${row.id}`, { method: 'DELETE' });
    await load();
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  return (
    <div className="space-y-6">
      {/* Account Information Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gray-700 px-3 py-2 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-white font-medium">Account Information</span>
          </div>
        </div>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => { setEditing(null); setOpen(true); }}>Add New</button>
      </div>

      {/* Customer Selection */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h3 className="text-gray-300 font-medium mb-3">Select Customer to View Card Pending Amounts</h3>
        <select
          value={selectedCustomerId}
          onChange={(e) => handleCustomerSelect(e.target.value)}
          className="w-full max-w-md bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Customers</option>
          {rows.map((row) => (
            <option key={row.customer_id} value={row.customer_id}>
              {row.customer_name}
            </option>
          ))}
        </select>
      </div>

      {/* Card Pending Amounts Section */}
      <CardPendingAmounts selectedCustomerId={selectedCustomerId} />

      {/* Accounts Table */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-gray-300 font-semibold mb-4">Account Details</h3>
        <DataTable 
          data={rows} 
          columns={schema.listColumns as any} 
          onEdit={(r)=>{setEditing(r); setOpen(true);}} 
          onDelete={onDelete} 
        />
      </div>

      {/* Account Form Modal */}
      <CrudFormModal 
        open={open} 
        onClose={()=>setOpen(false)} 
        fields={schema.fields} 
        initial={editing} 
        onSubmit={onSubmit} 
        title={editing?`Edit ${schema.title}`:`Add ${schema.title}`} 
      />
    </div>
  );
}


