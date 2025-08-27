"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/admin/DataTable";
import CombinedCustomerForm from "@/components/admin/CombinedCustomerForm";
import CustomerViewModal from "@/components/admin/CustomerViewModal";
import { schemas } from "@/lib/tableSchemas";
import PopupModal from "@/components/ui/PopupModal";
import { useData } from "@/lib/context/DataContext";

const schema = schemas.customers;

export default function CustomersPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
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

  // Use the global data context
  const { 
    state: { customers: rows, loading, error }, 
    fetchCustomers, 
    invalidateCache 
  } = useData();

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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
        
        const res = await fetch(`/api/customers/${id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(cleanValues) 
        });
        
        if (!res.ok) { 
          const j = await res.json().catch(() => ({})); 
          throw new Error(j.error || 'Update failed'); 
        }
        
        const updatedData = await res.json().catch(() => ({ id }));
        
        // Invalidate cache and refetch
        await invalidateCache();
        await fetchCustomers({ forceRefresh: true });
        
        return updatedData || { id };
      } else {
        console.log('Creating new customer');
        const res = await fetch(`/api/customers`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(cleanValues) 
        });
        
        if (!res.ok) { 
          const j = await res.json().catch(() => ({})); 
          throw new Error(j.error || 'Creation failed'); 
        }
        
        const newData = await res.json().catch(() => ({}));
        
        // Invalidate cache and refetch
        await invalidateCache();
        await fetchCustomers({ forceRefresh: true });
        
        return newData;
      }
    } catch (error) {
      console.error('Save error:', error);
      if (error instanceof Error) {
        setPopup({
          open: true,
          title: "Error",
          message: error.message,
          type: "error",
          confirmText: "OK"
        });
      }
      throw error;
    }
  };

  const handleDelete = async (row: any) => {
    if (!confirm("Delete this customer?")) return;
    
    try {
      const res = await fetch(`/api/customers/${row.id}`, { method: 'DELETE' });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Delete failed');
      }
      
      // Invalidate cache and refetch
      await invalidateCache();
      await fetchCustomers({ forceRefresh: true });
      
      setPopup({
        open: true,
        title: "Success",
        message: "Customer deleted successfully",
        type: "success",
        confirmText: "OK"
      });
    } catch (error) {
      console.error('Delete error:', error);
      if (error instanceof Error) {
        setPopup({
          open: true,
          title: "Error",
          message: error.message,
          type: "error",
          confirmText: "OK"
        });
      }
    }
  };

  // Show error state if there's an error
  if (error.customers) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{schema.title}</h1>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Customers</h2>
          <p className="text-red-300 mb-4">{error.customers}</p>
          <button 
            onClick={() => fetchCustomers({ forceRefresh: true })}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
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
            New Customer
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading.customers && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading customers...</span>
        </div>
      )}

      {/* Data Table */}
      {!loading.customers && (
        <DataTable 
          data={rows} 
          columns={schema.listColumns as any} 
          onEdit={(r) => { setEditing(r); setOpen(true); }} 
          onDelete={handleDelete}
          onView={(r) => { setViewing(r); }}
        />
      )}

      {/* Customer Form Modal */}
      <CombinedCustomerForm 
        open={open} 
        onClose={() => setOpen(false)} 
        initialCustomer={editing} 
        onSubmit={handleSave} 
        title={editing ? `Edit ${schema.title}` : `Add ${schema.title}`} 
      />

      {/* Customer View Modal */}
      {viewing && (
        <CustomerViewModal 
          key={viewing.id} // Force re-render when customer changes
          open={!!viewing}
          customer={viewing} 
          onClose={() => setViewing(null)} 
        />
      )}

      {/* Popup Modal */}
      <PopupModal
        open={popup.open}
        onClose={() => setPopup(prev => ({ ...prev, open: false }))}
        title={popup.title}
      >
        <div className="text-center">
          <p className="mb-4">{popup.message}</p>
          {popup.showCancel && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setPopup(prev => ({ ...prev, open: false }));
                  popup.onConfirm?.();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                {popup.confirmText || "Confirm"}
              </button>
              <button
                onClick={() => setPopup(prev => ({ ...prev, open: false }))}
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

