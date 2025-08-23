"use client";
import { useCallback, useEffect, useState } from "react";
// Use our API backed by PostgreSQL
import DataTable from "@/components/admin/DataTable";
import CrudFormModal from "@/components/admin/CrudFormModal";
import { schemas } from "@/lib/tableSchemas";

const schema = schemas.customer_credits;

export default function CustomerCreditsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/${schema.table}`);
    setRows((await res.json()) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSubmit = async (values: Record<string, any>) => {
    if (editing) {
      await fetch(`/api/${schema.table}/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    } else {
      await fetch(`/api/${schema.table}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    }
    await load();
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


