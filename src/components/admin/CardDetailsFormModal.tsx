"use client";

import { useCallback, useEffect, useState } from "react";

import { schemas } from "@/lib/tableSchemas";
import SearchableCustomerInput from "./SearchableCustomerInput";

interface CardDetailsFormModalProps {
  open: boolean;
  onClose: () => void;
  initial: Record<string, unknown> | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  title: string;
}

export default function CardDetailsFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  title,
}: CardDetailsFormModalProps) {
  const [values, setValues] = useState<Record<string, string | number | boolean | null>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Array<{ value: unknown; label: string }>>>({});
  const [availableCards, setAvailableCards] = useState<string[]>([]);
  const [isFormActive, setIsFormActive] = useState(false);
  

  const [popup, setPopup] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    showCancel?: boolean;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    open: false,
    title: "",
    message: "",
    type: "info"
  });
  
  const schema = schemas.card_details;
  const fields = schema.fields;

  // Reset form to pristine state and discard values
  const resetForm = () => {
    setValues({});
    setErrors({});
    setAvailableCards([]);
    setIsFormActive(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);



  // Update available card names based on selected bank and type
  const updateAvailableCards = useCallback((bankName: string, cardType: string) => {
    if (!bankName || !cardType) {
      setAvailableCards([]);
      return;
    }
    const cardNameField = schema.fields.find(f => f.name === 'card_name');
    const cardsByBank = (cardNameField as any)?.cardsByBank;
    if (!cardsByBank) {
      const allCards = cardNameField?.enumValues || [];
      setAvailableCards(allCards);
      return;
    }
    const bankCards = cardsByBank[bankName];
    if (!bankCards) {
      setAvailableCards([]);
      return;
    }
    const typeCards = bankCards[cardType];
    if (!typeCards) {
      setAvailableCards([]);
      return;
    }
    setAvailableCards(typeCards);
    setValues(prev => {
      const currentCardName = prev.card_name as string | undefined;
      if (currentCardName && !typeCards.includes(currentCardName)) {
        return { ...prev, card_name: '' };
      }
      return prev;
    });
  }, [schema.fields]);

  // Update available cards when bank or type changes
  useEffect(() => {
    if (values.bank_name && values.card_type) {
      updateAvailableCards(values.bank_name as string, values.card_type as string);
    }
  }, [values.bank_name, values.card_type, updateAvailableCards]);

  // Migration removed - no longer needed for form functionality

  // Initialize form values when the modal opens or when editing
  useEffect(() => {
    if (!open) return;
    if (Object.keys(values).length === 0 || initial !== null) {
      const v: Record<string, string | number | boolean | null> = {};
      fields.forEach((f) => {
        const initialValue = initial?.[f.name];
        if (initialValue !== undefined && initialValue !== null) {
          if (f.type === "datetime" && initialValue) {
            try {
              const date = new Date(initialValue as string);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;
                v[f.name] = formattedDate;
              } else {
                v[f.name] = "";
              }
            } catch (error) {
              v[f.name] = "";
            }
          } else {
            v[f.name] = initialValue as string | number | boolean | null;
          }
        } else {
          v[f.name] = f.type === "boolean" ? false : "";
        }
      });
      setValues(v);
      if (v.bank_name && v.card_type) {
        updateAvailableCards(v.bank_name as string, v.card_type as string);
      }
      setIsFormActive(false);
    }
  }, [open, initial, fields, updateAvailableCards]);

  // Real-time duplicate card number check (on blur or submit)
  const checkDuplicateCardNumber = useCallback(async (cardNumberInput?: string): Promise<boolean> => {
    const raw = typeof cardNumberInput === 'string' ? cardNumberInput : (values.card_number as string) ?? '';
    const cleanCardNumber = raw.replace(/\s+/g, '');
    if (initial?.card_number && String(initial.card_number).replace(/\s+/g, '') === cleanCardNumber) {
      setErrors(prev => {
        const { card_number, ...rest } = prev;
        return rest;
      });
      return false;
    }
    if (!cleanCardNumber || !/^\d{16}$/.test(cleanCardNumber)) {
      return false;
    }
    try {
      const res = await fetch(`/api/cards?card_number=${encodeURIComponent(cleanCardNumber)}&limit=10`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.data) && data.data.length > 0) {
        const conflict = data.data.find((item: any) => {
          const sameNumber = String(item.card_number) === cleanCardNumber;
          const differentId = initial?.id ? item.id !== (initial.id as number) : true;
          return sameNumber && differentId;
        });
        if (conflict) {
          setErrors(prev => ({ ...prev, card_number: "Card already exists with this number." }));
          return true;
        }
      }
      setErrors(prev => {
        const { card_number, ...rest } = prev;
        return rest;
      });
      return false;
    } catch {
      return false;
    }
  }, [values.card_number, initial]);

  // Handle field change
  const handleChange = (name: string, value: string | number | boolean | null) => {
    let newValues = { ...values, [name]: value } as Record<string, string | number | boolean | null>;
    if (!isFormActive) {
      setIsFormActive(true);
    }
    if (name === 'enable_defaults' && value === true) {
      newValues = { ...newValues, default_pos_type: '', custom_pos_type: '' };
    }
    if (name === 'card_number') {
      setErrors(prev => {
        const { card_number, ...rest } = prev;
        return rest;
      });
    }
    
    // Real-time validation: Due Day must be an integer between 1 and 31
    if (name === 'due_day') {
      const raw = value === null || value === undefined ? '' : String(value);
      setErrors(prev => {
        const next = { ...prev };
        const trimmed = raw.trim();
        if (trimmed === '') {
          next.due_day = "Please enter a valid day between 1 and 31";
        } else if (!/^\d{1,2}$/.test(trimmed)) {
          next.due_day = "Please enter a valid day between 1 and 31";
        } else {
          const n = parseInt(trimmed, 10);
          if (Number.isNaN(n) || n < 1 || n > 31) {
            next.due_day = "Please enter a valid day between 1 and 31";
          } else {
            const { due_day, ...rest } = next;
            return rest;
          }
        }
        return next;
      });
    }
    
    // Real-time validation: Default MDR % cannot be greater than Default Tax Rate %
    if (name === 'default_tax_rate' || name === 'default_mdr_rate') {
      const taxRaw = name === 'default_tax_rate' ? value : newValues.default_tax_rate;
      const mdrRaw = name === 'default_mdr_rate' ? value : newValues.default_mdr_rate;
      const tax = taxRaw === '' || taxRaw === undefined || taxRaw === null ? null : Number(taxRaw as number | string);
      const mdr = mdrRaw === '' || mdrRaw === undefined || mdrRaw === null ? null : Number(mdrRaw as number | string);
      setErrors(prev => {
        const next = { ...prev };
        if (tax !== null && mdr !== null && !Number.isNaN(tax) && !Number.isNaN(mdr) && mdr > tax) {
          next.default_mdr_rate = "Default MDR % can’t be greater than Default Tax Rate %";
        } else {
          const { default_mdr_rate, ...rest } = next;
          return rest;
        }
        return next;
      });
    }

    setValues(newValues);
    // Update available cards when bank or type changes
    if (name === 'bank_name' || name === 'card_type') {
      updateAvailableCards(
        name === 'bank_name' ? value as string : values.bank_name as string,
        name === 'card_type' ? value as string : values.card_type as string
      );
    }
  };

  // Validate form
  const validate = async (): Promise<boolean> => {
    const e: Record<string, string> = {};
    if (!values.customer_id) {
      e.customer_id = "Customer is required";
    }
    if (!values.bank_name) {
      e.bank_name = "Bank Name is required";
    }
    if (!values.card_type) {
      e.card_type = "Card Type is required";
    }
    if (!values.card_name) {
      e.card_name = "Card Name is required";
    } else if (availableCards.length > 0 && !availableCards.includes(values.card_name as string)) {
      e.card_name = "Selected card is not valid for the chosen bank and type";
    }
    if (values.enable_defaults) {
      const tax = values.default_tax_rate !== undefined && values.default_tax_rate !== null && String(values.default_tax_rate) !== ""
        ? Number(values.default_tax_rate)
        : null;
      const mdr = values.default_mdr_rate !== undefined && values.default_mdr_rate !== null && String(values.default_mdr_rate) !== ""
        ? Number(values.default_mdr_rate)
        : null;
      if (tax !== null && mdr !== null && !Number.isNaN(tax) && !Number.isNaN(mdr)) {
        if (mdr > tax) {
          e.default_mdr_rate = "Default MDR % can’t be greater than Default Tax Rate %";
        }
      }
    }
    if (values.card_number) {
      const cardNumber = (values.card_number as string).replace(/\s+/g, '');
      if (!/^\d{16}$/.test(cardNumber)) {
        e.card_number = "Card number must be exactly 16 digits";
      }
    }
    // Strict validation for due_day: required and must be 1-31
    {
      const ddRaw = values.due_day;
      const ddStr = ddRaw === undefined || ddRaw === null ? '' : String(ddRaw);
      const trimmed = ddStr.trim();
      if (trimmed === '') {
        e.due_day = "Please enter a valid day between 1 and 31";
      } else {
        const dd = Number(trimmed);
        if (!Number.isFinite(dd) || dd < 1 || dd > 31) {
          e.due_day = "Please enter a valid day between 1 and 31";
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Helper to sanitize payload before submit
  const sanitizePayload = (vals: Record<string, string | number | boolean | null>) => {
    const v: Record<string, any> = { ...vals };
    if (v.card_number) {
      v.card_number = String(v.card_number).replace(/\s+/g, '');
    }
    if (v.default_tax_rate === '' || v.default_tax_rate === undefined) v.default_tax_rate = null;
    else if (v.default_tax_rate !== null) v.default_tax_rate = Number(v.default_tax_rate);
    if (v.default_mdr_rate === '' || v.default_mdr_rate === undefined) v.default_mdr_rate = null;
    else if (v.default_mdr_rate !== null) v.default_mdr_rate = Number(v.default_mdr_rate);
    if (v.due_day === '' || v.due_day === undefined) v.due_day = null;
    else if (v.due_day !== null) v.due_day = Number(v.due_day);
    if (v.default_pos_type === '' || v.default_pos_type === 'Custom') v.default_pos_type = null;
    if (v.custom_pos_type === '') v.custom_pos_type = null;
    return v;
  };

  // Submit form
  const submit = async () => {
    const isValid = await validate();
    if (!isValid) {
      return;
    }
    const isDuplicate = await checkDuplicateCardNumber();
    if (isDuplicate) {
      return;
    }
    setLoading(true);
    try {
      const valuesToSubmit = sanitizePayload(values);
      await onSubmit(valuesToSubmit);
      handleClose();
    } catch (error) {
      // Rely on parent component to display toast error messages
    } finally {
      setLoading(false);
    }
  };

  // Compute due_day invalid state for disabling Save button
  const dueDayRaw = values.due_day;
  const dueDayStr = dueDayRaw === undefined || dueDayRaw === null ? '' : String(dueDayRaw);
  const isDueDayInvalid = (() => {
    const s = dueDayStr.trim();
    if (s === '') return true;
    if (!/^\d{1,2}$/.test(s)) return true;
    const n = parseInt(s, 10);
    return Number.isNaN(n) || n < 1 || n > 31;
  })();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-2xl bg-gray-900 text-gray-100 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Customer *</label>
            <SearchableCustomerInput
              onChange={(customerId) => handleChange('customer_id', customerId)}
              placeholder="Search customers by name, email, or phone..."
              error={errors.customer_id}
              initialCustomerName={
                initial?.customer_id 
                  ? options.customer_id?.find(opt => opt.value === initial.customer_id)?.label
                  : undefined
              }
              initialCustomerId={initial?.customer_id as number | undefined}
            />
          </div>

          {/* Bank Name Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Bank Name *</label>
            <select
              value={(values.bank_name as string) ?? ""}
              onChange={(e) => handleChange('bank_name', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            >
              <option value="">Select Bank...</option>
              {fields.find(f => f.name === 'bank_name')?.enumValues?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {errors.bank_name && (
              <span className="text-xs text-red-400">{errors.bank_name}</span>
            )}
          </div>

          {/* Card Type Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Card Type *</label>
            <select
              value={(values.card_type as string) ?? ""}
              onChange={(e) => handleChange('card_type', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            >
              <option value="">Select Card Type...</option>
              {fields.find(f => f.name === 'card_type')?.enumValues?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {errors.card_type && (
              <span className="text-xs text-red-400">{errors.card_type}</span>
            )}
          </div>

          {/* Card Name Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Card Name *</label>
            <select
              value={(values.card_name as string) ?? ""}
              onChange={(e) => handleChange('card_name', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
              disabled={availableCards.length === 0 && !values.card_name}
            >
              <option value="">Select Card Name...</option>
              {/* Show available cards first */}
              {availableCards.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {/* If we have a selected card name that's not in available cards, show it anyway */}
              {values.card_name && !availableCards.includes(values.card_name as string) && (
                <option key={values.card_name as string} value={values.card_name as string}>
                  {values.card_name} (Custom)
                </option>
              )}
            </select>
            {errors.card_name && (
              <span className="text-xs text-red-400">{errors.card_name}</span>
            )}
            {availableCards.length === 0 && values.bank_name && values.card_type && !values.card_name && (
              <span className="text-xs text-yellow-400">No cards available for selected bank and type</span>
            )}
          </div>

          {/* Card Number Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Card Number</label>
            <input
              type="text"
              value={(values.card_number as string) ?? ""}
              onChange={(e) => handleChange('card_number', e.target.value)}
              onBlur={(e) => checkDuplicateCardNumber(e.target.value)}
              placeholder="XXXX XXXX XXXX XXXX"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
            {errors.card_number && (
              <span className="text-xs text-red-400">{errors.card_number}</span>
            )}
          </div>

          {/* Due Day Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Due Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={(values.due_day as number | string) ?? ""}
              onChange={(e) => handleChange('due_day', e.target.value)}
              placeholder="1-31"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
            {errors.due_day && (
              <span className="text-xs text-red-400">{errors.due_day}</span>
            )}
          </div>
        </div>

        {/* Default POS/Tax/MDR Section */}
        <div className="mt-6 border-t border-gray-700 pt-4">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="enable_defaults"
              checked={(values.enable_defaults as boolean) ?? false}
              onChange={(e) => handleChange('enable_defaults', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="enable_defaults" className="text-sm text-gray-300 font-medium">
              Enable default POS/Tax/MDR for this card
            </label>
          </div>

          {/* Conditional fields - only show when checkbox is checked */}
          {(values.enable_defaults as boolean) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h4 className="text-sm text-blue-400 font-medium md:col-span-3 mb-3">
                Default Transaction Values
              </h4>
              
              {/* Default POS Type functionality removed when defaults are enabled */}

              {/* Default Tax Rate */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Default Tax Rate %</label>
                <input
                  type="number"
                  value={(values.default_tax_rate as string) ?? ""}
                  onChange={(e) => handleChange('default_tax_rate', e.target.value)}
                  placeholder="e.g., 2.5"
                  step="0.01"
                  min="0"
                  max="100"
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
                {errors.default_tax_rate && (
                  <span className="text-xs text-red-400">{errors.default_tax_rate}</span>
                )}
              </div>

              {/* Default MDR Rate */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Default MDR %</label>
                <input
                  type="number"
                  value={(values.default_mdr_rate as string) ?? ""}
                  onChange={(e) => handleChange('default_mdr_rate', e.target.value)}
                  placeholder="e.g., 2.0"
                  step="0.01"
                  min="0"
                  max="100"
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
                {errors.default_mdr_rate && (
                  <span className="text-xs text-red-400">{errors.default_mdr_rate}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={handleClose} className="px-4 py-2 rounded bg-gray-800 border border-gray-700">Cancel</button>
          <button
            onClick={submit}
            disabled={loading || isDueDayInvalid}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
