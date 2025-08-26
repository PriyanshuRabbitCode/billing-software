"use client";

import { useCallback, useEffect, useState } from "react";
// Now use our own API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CombinedCustomerForm from "@/components/admin/CombinedCustomerForm";
import CustomerViewModal from "@/components/admin/CustomerViewModal";
import { schemas } from "@/lib/tableSchemas";
import PopupModal from "@/components/ui/PopupModal";

const schema = schemas.customers;

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [, setLoading] = useState(true);
  const [popup, setPopup] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    showCancel?: boolean;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    open: false,
    title: "",
    message: "",
    type: "info"
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${schema.table}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
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
        setPopup({
          open: true,
          title: "Error",
          message: `Error saving record: ${err.message}`,
          type: "error"
        });
      } else {
        setPopup({
          open: true,
          title: "Error",
          message: "Error saving record",
          type: "error"
        });
      }
      throw err;
    }
  };

  const handleDelete = async (row: any) => {
    console.log('Delete called with row:', row);
    
    if (!row || !row.id) {
      setPopup({
        open: true,
        title: "Error",
        message: "Invalid row data for deletion",
        type: "error"
      });
      return;
    }
    
    setPopup({
      open: true,
      title: "Confirm Deletion",
      message: "Delete this customer and all related records (tax details, identity documents, accounts, card details, transactions)?",
      type: "warning",
      showCancel: true,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
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
          
          // Show success message
          setPopup({
            open: true,
            title: "Success",
            message: "Customer deleted successfully",
            type: "success"
          });
        } catch (error) {
          console.error('Delete error:', error);
          if (error instanceof Error) {
            setPopup({
              open: true,
              title: "Error",
              message: `Error deleting customer: ${error.message}`,
              type: "error"
            });
          } else {
            setPopup({
              open: true,
              title: "Error",
              message: "Error deleting customer. Please check console for details.",
              type: "error"
            });
          }
        }
      }
    });
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
                      New Customer
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

      <PopupModal
        open={popup.open}
        onClose={() => setPopup({ ...popup, open: false })}
        title={popup.title}
      >
        <div className="text-center">
          <p className="mb-4">{popup.message}</p>
          {popup.showCancel && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setPopup({ ...popup, open: false });
                  popup.onConfirm?.();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                {popup.confirmText || "Confirm"}
              </button>
              <button
                onClick={() => setPopup({ ...popup, open: false })}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                {popup.cancelText || "Cancel"}
              </button>
            </div>
          )}
        </div>
      </PopupModal>
    </div>
  );
}

