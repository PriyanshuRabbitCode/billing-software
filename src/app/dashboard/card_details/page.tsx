"use client";
import { useState } from "react";
import DataTable from "@/components/admin/DataTable";
import CardDetailsFormModal from "@/components/admin/CardDetailsFormModal";
import { schemas } from "@/lib/tableSchemas";
import { useData } from "@/lib/context/DataContext";

const schema = schemas.card_details;

export default function CardDetailsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Use the global data context
  const { 
    state: { cardDetails, loading, error }, 
    fetchCardDetails, 
    invalidateCache 
  } = useData();

  // Transform card details to include customer names
  const rows = cardDetails.map((card: any) => ({
    ...card,
    customer_name: card.customer_name || 'Unknown'
  }));

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
      
      await fetchCardDetails({ forceRefresh: true });
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
      
      await fetchCardDetails({ forceRefresh: true });
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
  if (error.cardDetails) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{schema.title}</h1>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Card Details</h2>
          <p className="text-red-300 mb-4">{error.cardDetails}</p>
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
      {loading.cardDetails && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading card details...</span>
        </div>
      )}

      {/* Data Table */}
      {!loading.cardDetails && (
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


