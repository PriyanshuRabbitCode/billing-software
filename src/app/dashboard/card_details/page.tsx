"use client";
import { useState, useEffect } from "react";
import DataTable from "@/components/admin/DataTable";
import CardDetailsFormModal from "@/components/admin/CardDetailsFormModal";
import { schemas } from "@/lib/tableSchemas";
import { useData } from "@/lib/context/DataContext";
import { useToastHelpers } from "@/components/ui/Toast";

const schema = schemas.card_details;

export default function CardDetailsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { 
    state: { cardDetails, loading, error }, 
    fetchCardDetails, 
    invalidateCache 
  } = useData();

  const { success, error: showError } = useToastHelpers();

  useEffect(() => {
    fetchCardDetails();
  }, [fetchCardDetails]);

  const rows = cardDetails.map((card: any) => ({
    ...card,
    customer_name: card.customer?.full_name || 'Unknown'
  }));

  const onSubmit = async (values: Record<string, any>) => {
    try {
      const dataToSubmit = { ...values };
      if (dataToSubmit.customer_id) {
        dataToSubmit.customer_id = Number(dataToSubmit.customer_id);
      }

      let res: Response;
      if (editing) {
        res = await fetch(`/api/${schema.table}/${editing.id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(dataToSubmit) 
        });
      } else {
        res = await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(dataToSubmit) 
        });
      }

      const responseText = await res.text();
      if (!res.ok) {
        let errorMessage = editing ? 'Failed to update card details' : 'Failed to create card details';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
            errorMessage = 'Server error occurred. Please check server logs.';
          } else if (responseText) {
            errorMessage = responseText.substring(0, 200) + '...';
          }
        }
        throw new Error(errorMessage);
      }
      await fetchCardDetails({ forceRefresh: true });
      success(editing ? 'Card updated successfully.' : 'Card added successfully.');
      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        showError('Failed to save card details. Please try again.', error.message);
      } else {
        showError('Failed to save card details. Please try again.');
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
      await fetchCardDetails({ forceRefresh: true });
      success('Card deleted successfully.');
    } catch (error) {
      if (error instanceof Error) {
        showError('Failed to delete card. Please try again.', error.message);
      } else {
        showError('Failed to delete card. Please try again.');
      }
    }
  };

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

      {loading.cardDetails && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading card details...</span>
        </div>
      )}

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


