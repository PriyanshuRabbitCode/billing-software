"use client";

import { useMemo, useState } from "react";

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onView?: (row: T) => void;
  pageSize?: number;
  showActions?: boolean;
}

export default function DataTable<T extends { id?: number | string }>({
  data,
  columns,
  onEdit,
  onDelete,
  onView,
  pageSize = 10,
  showActions = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    if (!search) return data;
    const term = search.toLowerCase();
    return data.filter((row) =>
      Object.values(row as any).some((v) => String(v ?? "").toLowerCase().includes(term))
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const sortedCopy = [...filtered];
    sortedCopy.sort((a: any, b: any) => {
      const av = a[sortKey as any];
      const bv = b[sortKey as any];
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === "asc" ? -1 : 1;
      if (bv == null) return sortDir === "asc" ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const aStr = String(av).toLowerCase();
      const bStr = String(bv).toLowerCase();
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sortedCopy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 rounded-xl border border-gray-800 shadow-lg">
      <div className="p-6 flex items-center justify-between gap-4 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search records..."
            className="w-full md:w-80 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="text-sm text-gray-400">
          {filtered.length} of {data.length} records
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  onClick={() => handleSort(String(c.key), c.sortable)}
                  className={`px-6 py-4 text-left font-semibold whitespace-nowrap ${
                    c.sortable ? "cursor-pointer select-none hover:text-blue-400" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{c.label}</span>
                    {sortKey === String(c.key) && (
                      <span className="text-blue-400">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
              ))}
              {showActions && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row: any) => (
              <tr 
                key={row.id ?? `row-${pageData.indexOf(row)}`} 
                className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                onClick={() => onView && onView(row)}
              >
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-6 py-4 whitespace-nowrap">
                    {c.render ? c.render(row) : String(row[c.key as any] ?? "—")}
                  </td>
                ))}
                {showActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    {onView && (
                      <button
                        onClick={() => onView(row)}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white mr-2 transition-colors text-sm font-medium"
                      >
                        View
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white mr-2 transition-colors text-sm font-medium"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          onDelete(row);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columns.length + (showActions ? 1 : 0)} className="px-6 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📋</span>
                    </div>
                    <p className="text-lg font-medium">No data found</p>
                    <p className="text-sm">Try adjusting your search criteria</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between p-6 border-t border-gray-800">
        <div className="text-sm text-gray-400">
          Page {page} of {totalPages} • {pageData.length} records
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={page === 1}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}


