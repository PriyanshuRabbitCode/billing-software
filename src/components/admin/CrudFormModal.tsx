"use client";

import { useEffect, useMemo, useState } from "react";

export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "enum"
  | "boolean"
  | "datetime";

export interface CrudField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  enumValues?: string[]; // for enum
  relation?: {
    table: string;
    valueField: string;
    labelField: string;
  };
}

export interface CrudFormModalProps<T> {
  open: boolean;
  onClose: () => void;
  fields: CrudField[];
  initial?: Partial<T> | null;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  title: string;
}

export default function CrudFormModal<T>({
  open,
  onClose,
  fields,
  initial,
  onSubmit,
  title,
}: CrudFormModalProps<T>) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Array<{ value: any; label: string }>>>({});

  useEffect(() => {
    const v: Record<string, any> = {};
    fields.forEach((f) => {
      const initialValue = (initial as any)?.[f.name];
      if (initialValue !== undefined && initialValue !== null) {
        v[f.name] = initialValue;
      } else {
        v[f.name] = f.type === "boolean" ? false : "";
      }
    });
    console.log('Setting form values:', v);
    setValues(v);
  }, [initial, fields]);

  useEffect(() => {
    let active = true;
    async function loadRelations() {
      const relationFields = fields.filter((f) => f.relation);
      if (relationFields.length === 0) return;
      const loaded: Record<string, Array<{ value: any; label: string }>> = {};
      for (const f of relationFields) {
        try {
          const res = await fetch(`/api/rel/${f.relation!.table}`);
          const list = (await res.json()) as Array<Record<string, any>>;
          loaded[f.name] = list.map((r) => ({ value: r[f.relation!.valueField], label: r[f.relation!.labelField] }));
        } catch (e) {
          loaded[f.name] = [];
        }
      }
      if (active) setOptions(loaded);
    }
    loadRelations();
    return () => {
      active = false;
    };
  }, [fields]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.required && (v === "" || v === undefined || v === null)) {
        e[f.name] = `${f.label} is required`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    console.log('Form values before validation:', values);
    if (!validate()) {
      console.log('Validation failed:', errors);
      return;
    }
    setLoading(true);
    try {
      console.log('Submitting values:', values);
      await onSubmit(values);
      setValues({}); // Reset form
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-gray-900 text-gray-100 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{f.label}{f.required ? " *" : ""}</label>
              {f.type === "textarea" && (
                <textarea
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  placeholder={f.placeholder}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 h-24"
                />
              )}
              {(f.type === "text" || f.type === "number" || f.type === "datetime") && (
                <>
                  {f.name === "document_image" ? (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Store the file object for later use in form submission
                          setValues({ ...values, [f.name]: file });
                        }
                      }}
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                      placeholder={f.placeholder}
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
                    />
                  )}
                </>
              )}
              {f.type === "boolean" && (
                <select
                  value={String(values[f.name] ?? false)}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value === "true" })}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              )}
              {(f.type === "enum" || f.type === "select") && (
                <select
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
                >
                  <option value="">Select...</option>
                  {f.name === 'card_name' ? (
                    // Filter card options based on selected bank and type
                    f.enumValues
                      ?.filter(card => {
                        const bankPrefix = values['bank_name']?.split(' ')[0];
                        const cardType = values['card_type']?.split(' ')[0];
                        return bankPrefix && cardType ? 
                          card.startsWith(bankPrefix) && card.includes(cardType) : true;
                      })
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))
                  ) : (
                    // Regular enum options
                    f.enumValues?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))
                  )}
                  {f.relation && options[f.name]?.map((opt) => {
                    // For customer selection in tax details, check for existing details
                    if (f.relation?.table === 'customers' && values['pan_no']) {
                      return (
                        <option 
                          key={opt.value} 
                          value={opt.value}
                          style={{ 
                            backgroundColor: values['pan_no'] ? '#4a5568' : undefined,
                            fontWeight: values['pan_no'] ? 'bold' : undefined
                          }}
                        >
                          {opt.label} {values['pan_no'] ? `(PAN: ${values['pan_no']})` : ''}
                        </option>
                      );
                    }
                    return (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    );
                  })}
                </select>
              )}
              {errors[f.name] && (
                <span className="text-xs text-red-400">{errors[f.name]}</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-800 border border-gray-700">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}


