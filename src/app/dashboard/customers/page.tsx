"use client";

import { useCallback, useEffect, useState } from "react";
// Now use our own API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CombinedCustomerForm from "@/components/admin/CombinedCustomerForm";
import CustomerViewModal from "@/components/admin/CustomerViewModal";
import { schemas } from "@/lib/tableSchemas";

const schema = schemas.customers;

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${schema.table}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) { setRows([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (values: Record<string, any>) => {
    try {
      console.log('Saving values:', values);
      
      // Clean up values - handle empty strings and numeric fields
      const cleanValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => {
          const field = schema.fields.find(f => f.name === key);
          
          // Handle empty values
          if (value === "") {
            // If field is required, keep empty string, otherwise null
            return [key, field?.required ? "" : null];
          }
          
          // Handle numeric fields
          if (field?.type === "number" && value !== null) {
            const num = Number(value);
            return [key, isNaN(num) ? null : num];
          }
          
          return [key, value];
        })
      );
      
      console.log('Clean values:', cleanValues);
      
      if (values.id || editing) {
        // Use the ID from values if available, otherwise from editing state
        const id = values.id || editing?.id;
        console.log(`Updating customer with ID: ${id}`);
        
        const res = await fetch(`/api/${schema.table}/${id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(cleanValues) 
        });
        
        if (!res.ok) { 
          const j = await res.json().catch(() => ({})); 
          throw new Error(j.error || 'Update failed'); 
        }
        
        const updatedData = await res.json().catch(() => ({ id }));
        await load();
        return updatedData || { id };
      } else {
        console.log('Creating new customer');
        const res = await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(cleanValues) 
        });
        
        if (!res.ok) { 
          const j = await res.json().catch(() => ({})); 
          throw new Error(j.error || 'Create failed'); 
        }
        
        const data = await res.json();
        console.log('Created customer:', data);
        await load();
        return data;
      }
    } catch (err) {
      console.error('Save error:', err);
      if (err instanceof Error) {
        alert(`Error saving record: ${err.message}`);
      } else {
        alert('Error saving record');
      }
      throw err;
    }
  };

  const handleDelete = async (row: any) => {
    console.log('Delete called with row:', row);
    
    if (!row || !row.id) {
      alert('Invalid row data for deletion');
      return;
    }
    
    if (!confirm("Delete this customer and all related records (tax details, identity documents, accounts, card details, transactions)?")) return;
    
    try {
      console.log(`Attempting to delete customer ${row.id}`);
      const res = await fetch(`/api/${schema.table}/${row.id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('Delete response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to delete customer:', errorData);
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json().catch(() => ({}));
      console.log('Delete result:', result);
      
      console.log('Customer deleted successfully');
      await load();
    } catch (error) {
      console.error('Delete error:', error);
      if (error instanceof Error) {
        alert(`Error deleting customer: ${error.message}`);
      } else {
        alert('Error deleting customer. Please check console for details.');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{schema.title}</h1>
        <button
          className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add New
        </button>
      </div>

      <DataTable
        data={rows}
        columns={schema.listColumns as any}
        onView={(row) => {
          setViewing(row);
        }}
        onEdit={(row) => {
          setEditing(row);
          setOpen(true);
        }}
        onDelete={handleDelete}
      />

      <CombinedCustomerForm
        open={open}
        onClose={() => setOpen(false)}
        initialCustomer={editing}
        onSubmit={handleSave}
        title={editing ? `Edit ${schema.title}` : `Add ${schema.title}`}
      />

      <CustomerViewModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        customer={viewing}
      />
    </div>
  );
}

