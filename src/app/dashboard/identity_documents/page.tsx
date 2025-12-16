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
    
    // Fetch all customers once and map by id
    const customersRes = await fetch(`/api/customers`);
    const customersResult = await customersRes.json();
    const customersMap = new Map<string, any>();
    (customersResult.data || []).forEach((c: any) => customersMap.set(String(c.id), c));

    const transformedData = (data ?? []).map((row: any) => {
      const customer = customersMap.get(String(row.customer_id));
      return {
        ...row,
        customer_name: customer?.full_name || 'Unknown'
      };
    });
    
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

    const raw = await response.text();
    if (!response.ok) {
      let errorMessage = 'Upload failed';
      try {
        const data = JSON.parse(raw);
        errorMessage = data.error || data.message || errorMessage;
      } catch {
        if (raw.includes('<html') || raw.includes('<!DOCTYPE')) {
          errorMessage = 'Server error occurred. Please check server logs.';
        } else if (raw) {
          errorMessage = raw.substring(0, 200) + '...';
        }
      }
      throw new Error(errorMessage);
    }

    try {
      const data = JSON.parse(raw);
      return data.path;
    } catch {
      throw new Error('Invalid server response');
    }
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

      let res: Response;
      if (editing) {
        res = await fetch(`/api/${schema.table}/${editing.id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(values) 
        });
      } else {
        res = await fetch(`/api/${schema.table}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(values) 
        });
      }

      const responseText = await res.text();
      if (!res.ok) {
        let errorMessage = 'Failed to save document';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
            errorMessage = 'Server error occurred. Please check server logs.';
          } else if (responseText) {
            errorMessage = responseText.substring(0, 200) + '...';
          }
        }
        throw new Error(errorMessage);
      }

      await load();
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Error saving document. Please try again.');
    }
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    try {
      const res = await fetch(`/api/${schema.table}/${row.id}`, { method: 'DELETE' });
      const responseText = await res.text();
      if (!res.ok) {
        let errorMessage = 'Failed to delete document';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
            errorMessage = 'Server error occurred. Please check server logs.';
          } else if (responseText) {
            errorMessage = responseText.substring(0, 200) + '...';
          } else {
            errorMessage = res.statusText || `HTTP ${res.status}`;
          }
        }
        throw new Error(errorMessage);
      }
      await load();
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Error deleting document. Please try again.');
    }
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


