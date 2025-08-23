"use client";
import { useCallback, useEffect, useState } from "react";
// Use our API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CardDetailsFormModal from "@/components/admin/CardDetailsFormModal";
import { schemas } from "@/lib/tableSchemas";

const schema = schemas.card_details;

export default function CardDetailsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      // First ensure the card_number column exists
      await fetch('/api/migrate');
      
      const res = await fetch(`/api/${schema.table}`);
      const data = await res.json();
      
      // Transform the data to include customer names
      const transformedData = await Promise.all((data ?? []).map(async (row: any) => {
        try {
          const customerRes = await fetch(`/api/customers/${row.customer_id}`);
          const customer = await customerRes.json();
          return {
            ...row,
            customer_name: customer.full_name
          };
        } catch (err) {
          console.error('Error fetching customer:', err);
          return row;
        }
      }));
      
      setRows(transformedData);
    } catch (err) {
      console.error('Error loading data:', err);
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      setOpen(false); // Close the modal after successful submission
    } catch (err) {
      console.error('Error saving card details:', err);
      if (err instanceof Error) {
        alert(`Error saving card details: ${err.message}`);
      } else {
        alert('Error saving card details. Please try again.');
      }
      throw err; // Re-throw to propagate to the form component
    }
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    await fetch(`/api/${schema.table}/${row.id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{schema.title}</h1>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => { setEditing(null); setOpen(true); }}>Add New</button>
      </div>
      <DataTable data={rows} columns={schema.listColumns as any} onEdit={(r)=>{setEditing(r); setOpen(true);}} onDelete={onDelete} />
      <CardDetailsFormModal 
        open={open} 
        onClose={()=>setOpen(false)} 
        initial={editing} 
        onSubmit={onSubmit} 
        title={editing?`Edit ${schema.title}`:`Add ${schema.title}`} 
      />
    </div>
  );
}


