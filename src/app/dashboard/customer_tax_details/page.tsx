"use client";
import { useCallback, useEffect, useState } from "react";
// Use our API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CrudFormModal from "@/components/admin/CrudFormModal";
import { schemas } from "@/lib/tableSchemas";

const schema = schemas.customer_tax_details;

export default function CustomerTaxDetailsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [existingTaxDetails, setExistingTaxDetails] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

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

  // Function to check existing tax details for a customer
  const checkExistingTaxDetails = useCallback(async (customerId: string) => {
    try {
      // First get customer details from a single customers call
      const customersRes = await fetch(`/api/customers`);
      const customersResult = await customersRes.json();
      const customer = (customersResult.data || []).find((c: any) => String(c.id) === String(customerId));
      setSelectedCustomer(customer || null);

      // Then check for existing tax details
      const res = await fetch(`/api/${schema.table}`);
      const allTaxDetails = await res.json();
      const existing = allTaxDetails.find((detail: any) => detail.customer_id === customerId);
      
      if (existing) {
        setExistingTaxDetails(existing);
        return true;
      } else {
        setExistingTaxDetails(null);
        return false;
      }
    } catch (err) {
      console.error('Error checking existing tax details:', err);
      return false;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Validate PAN number format
  const validatePAN = (pan: string): boolean => {
    // PAN format: AAAAA1234A (5 letters + 4 numbers + 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };



  // Load customer details for PAN validation
  const loadCustomerDetails = async (customerId: string) => {
    try {
      const res = await fetch(`/api/customers?id=${customerId}`);
      if (!res.ok) throw new Error('Failed to load customer details');
      const result = await res.json();
      return result.data[0];
    } catch (err) {
      console.error('Error loading customer details:', err);
      return null;
    }
  };

  const onSubmit = async (values: Record<string, any>) => {
    try {
      // Check for existing tax details when customer is selected
      if (!editing && values.customer_id) {
        const hasExisting = await checkExistingTaxDetails(values.customer_id);
        if (hasExisting) {
          const proceed = confirm(
            `Tax details already exist for this customer:\n\n` +
            `PAN: ${existingTaxDetails.pan_no}\n` +
            `Aadhaar: ${existingTaxDetails.aadhaar_no}\n\n` +
            `Would you like to edit the existing details instead?`
          );
          if (proceed) {
            setEditing(existingTaxDetails);
            return;
          }
        }
      }

      // Validate required fields
      if (!values.customer_id || !values.pan_no) {
        alert('Customer and PAN number are required');
        return;
      }

      // Validate PAN format
      if (!validatePAN(values.pan_no)) {
        alert('Invalid PAN number format. Format should be: AAAAA1234A');
        return;
      }

      // Load customer details to verify name
      if (selectedCustomer) {
        // Extract first letters of each word in customer name
        const nameInitials = selectedCustomer.full_name
          .split(' ')
          .map((word: string) => word[0])
          .join('')
          .substring(0, 3);

        // Check if PAN starts with customer name initials (optional validation)
        if (!values.pan_no.startsWith(nameInitials)) {
          const proceed = confirm(
            `Warning: PAN number initials do not match customer name initials.\n\n` +
            `Customer Name: ${selectedCustomer.full_name}\n` +
            `Expected Initials: ${nameInitials}\n` +
            `PAN Number: ${values.pan_no}\n\n` +
            `Proceed anyway?`
          );
          if (!proceed) return;
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
      setOpen(false);
      setExistingTaxDetails(null);
      setSelectedCustomer(null);
    } catch (err) {
      console.error('Error saving tax details:', err);
      alert('Error saving tax details. Please try again.');
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


