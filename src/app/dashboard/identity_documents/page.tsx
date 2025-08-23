"use client";
import { useCallback, useEffect, useState } from "react";
// Use our API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CrudFormModal from "@/components/admin/CrudFormModal";
import { schemas } from "@/lib/tableSchemas";

const schema = schemas.identity_documents;

export default function IdentityDocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFileUpload = async (file: File, customerId: string, docType: string) => {
    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('customerId', customerId);
    formData.append('docType', docType);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return data.path;
  };

  const onSubmit = async (values: Record<string, any>) => {
    try {
      // Validate document number based on type
      const docType = values.document_type;
      const docNumber = values.document_number;

      if (docType === "Aadhaar Card") {
        if (!/^\d{12}$/.test(docNumber)) {
          alert("Aadhaar number must be 12 digits");
          return;
        }
      } else if (docType === "PAN Card") {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(docNumber)) {
          alert("Invalid PAN number format (e.g., ABCDE1234F)");
          return;
        }
      } else if (docType === "Voter ID") {
        if (!/^[A-Z]{3}\d{7}$/.test(docNumber)) {
          alert("Invalid Voter ID format (e.g., ABC1234567)");
          return;
        }
      }

      // Handle file upload if there's a file
      if (values.document_image instanceof File) {
        try {
          const imageUrl = await handleFileUpload(
            values.document_image,
            values.customer_id,
            values.document_type
          );
          values.document_image = imageUrl;
        } catch (err: any) {
          alert(err.message || 'Error uploading file');
          return;
        }
      }

      if (editing) {
        await fetch(`/api/${schema.table}/${editing.id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(values) 
        });
      } else {
        await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(values) 
        });
      }
      await load();
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Error saving document. Please try again.');
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
      <CrudFormModal open={open} onClose={()=>setOpen(false)} fields={schema.fields} initial={editing} onSubmit={onSubmit} title={editing?`Edit ${schema.title}`:`Add ${schema.title}`} />
    </div>
  );
}


