"use client";
import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/admin/DataTable";
import CardDetailsFormModal from "@/components/admin/CardDetailsFormModal";
import { schemas } from "@/lib/tableSchemas";
import { useDashboard } from "@/lib/hooks/useDashboard";

const schema = schemas.card_details;

export default function CardDetailsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Use dashboard data to get card details with customer info
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError } = useDashboard();

  const load = useCallback(async () => {
    try {
      // If we have dashboard data, use the card details from there
      if (dashboardData?.cardDetails) {
        setRows(dashboardData.cardDetails);
        return;
      }

      // Fallback: fetch card details directly if dashboard data not available
      const res = await fetch(`/api/${schema.table}`);
      const data = await res.json();
      
             // If we have customer data from dashboard, use it to enrich card details
       if (dashboardData?.customers) {
         const customerMap = new Map(
           dashboardData.customers.map((customer: any) => [customer.id, customer])
         );
         
         const transformedData = data.map((row: any) => ({
           ...row,
           customer_name: (customerMap.get(row.customer_id) as any)?.full_name || 'Unknown'
         }));
        
        setRows(transformedData);
      } else {
        // Fallback: fetch customer data individually (less efficient)
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
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setRows([]);
    }
  }, [dashboardData]);

  useEffect(() => { 
    load(); 
  }, [load]);

  const onSubmit = async (values: Record<string, any>) => {
    try {
      console.log('Submitting card details:', values);
      
      // Make a clean copy of the values to send
      const dataToSubmit = { ...values };
      
      // Ensure we're sending the right data types
      if (dataToSubmit.customer_id) {
        // Make sure customer_id is properly formatted (some APIs expect string, some expect number)
        dataToSubmit.customer_id = String(dataToSubmit.customer_id);
      }
      
      console.log('Final data to submit:', JSON.stringify(dataToSubmit, null, 2));

      if (editing) {
        console.log('Updating existing card details with ID:', editing.id);
        const res = await fetch(`/api/${schema.table}/${editing.id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(dataToSubmit) 
        });
        
        const responseText = await res.text();
        console.log('Response status:', res.status);
        console.log('Response text:', responseText);
        
        if (!res.ok) {
          let errorMessage = 'Failed to update card details';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error('Error parsing error response:', parseError);
          }
          throw new Error(errorMessage);
        }
      } else {
        console.log('Creating new card details');
        const res = await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(dataToSubmit) 
        });
        
        const responseText = await res.text();
        console.log('Response status:', res.status);
        console.log('Response text:', responseText);
        
        if (!res.ok) {
          let errorMessage = 'Failed to create card details';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error('Error parsing error response:', parseError);
          }
          throw new Error(errorMessage);
        }
      }
      
      await load();
      setOpen(false);
    } catch (error) {
      console.error('Submit error:', error);
      if (error instanceof Error) {
        alert(`Error saving card details: ${error.message}`);
      } else {
        alert('Error saving card details. Please try again.');
      }
    }
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    
    try {
      const res = await fetch(`/api/${schema.table}/${row.id}`, { method: 'DELETE' });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Delete failed');
      }
      
      await load();
    } catch (error) {
      console.error('Delete error:', error);
      if (error instanceof Error) {
        alert(`Error deleting record: ${error.message}`);
      } else {
        alert('Error deleting record. Please try again.');
      }
    }
  };

  // Show error state if there's an error
  if (dashboardError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{schema.title}</h1>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Card Details</h2>
          <p className="text-red-300 mb-4">{dashboardError}</p>
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
            New Card
          </button>
        </div>
      </div>

      {/* Loading State */}
      {dashboardLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading card details...</span>
        </div>
      )}

      {/* Data Table */}
      {!dashboardLoading && (
        <DataTable 
          data={rows} 
          columns={schema.listColumns as any} 
          onEdit={(r) => { setEditing(r); setOpen(true); }} 
          onDelete={onDelete}
        />
      )}

      <CardDetailsFormModal 
        open={open} 
        onClose={() => setOpen(false)} 
        initial={editing} 
        onSubmit={onSubmit} 
        title={editing ? `Edit ${schema.title}` : `Add ${schema.title}`} 
      />
    </div>
  );
}


