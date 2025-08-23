import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/postgres";
import { schemas } from "@/lib/tableSchemas";

export const runtime = 'nodejs';

// Minimal helper to fetch id/label pairs for relation dropdowns
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  const allowed = new Set(Object.values(schemas).map((s) => s.table));
  if (!allowed.has(table)) {
    return NextResponse.json({ error: "Table not allowed" }, { status: 400 });
  }
  try {
    const { rows } = await query(`SELECT * FROM ${table} LIMIT 1000`);
    return NextResponse.json(rows ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


