"use client";

import { useCallback, useEffect, useState } from "react";

import { schemas } from "@/lib/tableSchemas";
import SearchableCustomerInput from "./SearchableCustomerInput";
import PopupModal from "../ui/PopupModal";

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
  
  // Debug: Log whenever values change
  useEffect(() => {
    console.log('Form values changed:', values);
  }, [values]);
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



  // Update available card names based on selected bank and type
  const updateAvailableCards = useCallback((bankName: string, cardType: string) => {
    console.log('updateAvailableCards called with:', { bankName, cardType });
    
    if (!bankName || !cardType) {
      console.log('Missing bank name or card type, clearing available cards');
      setAvailableCards([]);
      return;
    }
    
    // Get the card mapping from schema
    const cardNameField = schema.fields.find(f => f.name === 'card_name');
    const cardsByBank = (cardNameField as any)?.cardsByBank;
    
    if (!cardsByBank) {
      console.log('No cardsByBank mapping found, falling back to all cards');
      const allCards = cardNameField?.enumValues || [];
      setAvailableCards(allCards);
      return;
    }
    
    // Get the specific cards for this bank and card type
    const bankCards = cardsByBank[bankName];
    if (!bankCards) {
      console.log('No cards found for bank:', bankName);
      setAvailableCards([]);
      return;
    }
    
    const typeCards = bankCards[cardType];
    if (!typeCards) {
      console.log('No cards found for bank + type:', { bankName, cardType });
      setAvailableCards([]);
      return;
    }
    
    console.log('Filtered cards for', bankName, '+', cardType, ':', typeCards);
    setAvailableCards(typeCards);
    
    // If current card name is not in the filtered list, clear it
    if (values.card_name && !typeCards.includes(values.card_name as string)) {
      console.log('Current card name not valid for this bank+type, clearing');
      setValues(prev => ({ ...prev, card_name: '' }));
    }
  }, [schema.fields, values.card_name]);

  // Update available cards when bank or type changes
  useEffect(() => {
    if (values.bank_name && values.card_type) {
      updateAvailableCards(values.bank_name as string, values.card_type as string);
    }
  }, [values.bank_name, values.card_type, updateAvailableCards]);

  // Migration removed - no longer needed for form functionality

  // Initialize form values when the modal opens or when editing
  useEffect(() => {
    // Only initialize if we don't have values yet or if initial has changed
    if (Object.keys(values).length === 0 || initial !== null) {
      const v: Record<string, string | number | boolean | null> = {};
      fields.forEach((f) => {
        const initialValue = initial?.[f.name];
        if (initialValue !== undefined && initialValue !== null) {
          // Handle date fields - convert ISO string to YYYY-MM-DD format for HTML date input
          if (f.type === "datetime" && initialValue) {
            try {
              const date = new Date(initialValue as string);
              if (!isNaN(date.getTime())) {
                // Convert to local date in YYYY-MM-DD format for HTML date input
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;
                v[f.name] = formattedDate;
              } else {
                v[f.name] = "";
              }
            } catch (error) {
              console.error('Error parsing date:', error);
              v[f.name] = "";
            }
          } else {
            v[f.name] = initialValue as string | number | boolean | null;
          }
        } else {
          v[f.name] = f.type === "boolean" ? false : "";
        }
      });
      console.log('Setting form values:', v);
      console.log('Initial values received:', initial);
      console.log('Fields from schema:', fields.map(f => f.name));
      setValues(v);
      
      // Update available cards if bank and type are set
      if (v.bank_name && v.card_type) {
        console.log('Initializing with bank and type, updating available cards');
        updateAvailableCards(v.bank_name as string, v.card_type as string);
      }
      
      // Reset form active state on initialization
      setIsFormActive(false);
    }
  }, [initial, fields, updateAvailableCards, values]); // Added values dependency to prevent unnecessary re-initialization

  // Load customer options for initial value display
  useEffect(() => {
    let active = true;
    async function loadCustomerOptions() {
      try {
        const res = await fetch(`/api/customers`);
        const result = await res.json();
        const list = result.data || result;
        const customerOptions = list.map((r: any) => ({ value: r.id, label: r.full_name as string }));
        if (active) {
          setOptions(prev => ({ ...prev, customer_id: customerOptions }));
        }
      } catch {
        if (active) {
          setOptions(prev => ({ ...prev, customer_id: [] }));
        }
      }
    }
    loadCustomerOptions();
    return () => {
      active = false;
    };
  }, []);



  // Handle field change
  const handleChange = (name: string, value: string | number | boolean | null) => {
    const newValues = { ...values, [name]: value };
    console.log(`Field ${name} changed to:`, value);
    console.log('New form values:', newValues);
    
    // Mark form as active when user starts interacting
    if (!isFormActive) {
      setIsFormActive(true);
    }
    
    setValues(newValues);
    
    // Update available cards when bank or type changes
    if (name === 'bank_name' || name === 'card_type') {
      console.log('Updating available cards for:', name, value);
      updateAvailableCards(
        name === 'bank_name' ? value as string : values.bank_name as string,
        name === 'card_type' ? value as string : values.card_type as string
      );
    }
  };

  // Validate form
  const validate = async (): Promise<boolean> => {
    const e: Record<string, string> = {};
    
    // Check required fields
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
    
    // Validate custom POS Type when "Custom" is selected
    if (values.enable_defaults && values.default_pos_type === "Custom" && !values.custom_pos_type) {
      e.custom_pos_type = "Custom POS Type is required when 'Custom' is selected";
    }
    
    // Validate card number format if provided
    if (values.card_number) {
      // Remove spaces and check if it's a valid card number format
      const cardNumber = (values.card_number as string).replace(/\s+/g, '');
      
      // Validate exactly 16 digits
      if (!/^\d{16}$/.test(cardNumber)) {
        e.card_number = "Card number must be exactly 16 digits";
      }
      // Note: Duplicate card number validation is handled by the API
      // No need to pre-check here as the API will return proper error messages
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Submit form
  const submit = async () => {
    console.log('Form values before validation:', values);
    const isValid = await validate();
    if (!isValid) {
      console.log('Validation failed:', errors);
      return;
    }
    
    setLoading(true);
    try {
      // Clean card number by removing spaces before submission (API will handle formatting)
      if (values.card_number) {
        values.card_number = (values.card_number as string).replace(/\s+/g, '');
      }
      
      console.log('Submitting values:', values);
      console.log('enable_defaults value:', values.enable_defaults);
      console.log('default_pos_type value:', values.default_pos_type);
      console.log('default_tax_rate value:', values.default_tax_rate);
      console.log('default_mdr_rate value:', values.default_mdr_rate);
      
      // Create a copy of values to avoid reference issues
      const valuesToSubmit = { ...values };
      
      // Log the exact payload being sent
      console.log('Final payload to submit:', JSON.stringify(valuesToSubmit, null, 2));
      
      try {
        await onSubmit(valuesToSubmit);
        onClose();
      } catch (submitError) {
        console.error('Submit error details:', submitError);
        throw submitError; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error('Submit error:', error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        setPopup({
          open: true,
          title: "Error",
          message: `Error: ${error.message}`,
          type: "error"
        });
      } else {
        console.error('Unknown error type:', typeof error);
        setPopup({
          open: true,
          title: "Error",
          message: "An unknown error occurred",
          type: "error"
        });
      }
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
              placeholder="XXXX XXXX XXXX XXXX"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
            {errors.card_number && (
              <span className="text-xs text-red-400">{errors.card_number}</span>
            )}
          </div>

          {/* Due Date Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Due Date</label>
            <input
              type="date"
              value={(values.due_date as string) ?? ""}
              onChange={(e) => handleChange('due_date', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
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
              
              {/* Default POS Type */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Default POS Type</label>
                <select
                  value={(values.default_pos_type as string) ?? ""}
                  onChange={(e) => handleChange('default_pos_type', e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">Select POS Type</option>
                  <option value="MP">MP</option>
                  <option value="PH">PH</option>
                  <option value="MOS">MOS</option>
                  <option value="Custom">Custom</option>
                </select>
                
                {/* Custom POS Type Input - only show when "Custom" is selected */}
                {values.default_pos_type === "Custom" && (
                  <div>
                    <input
                      type="text"
                      value={(values.custom_pos_type as string) ?? ""}
                      onChange={(e) => handleChange('custom_pos_type', e.target.value)}
                      placeholder="Enter custom POS Type"
                      className={`bg-gray-700 border rounded px-3 py-2 mt-2 w-full ${
                        errors.custom_pos_type ? 'border-red-500' : 'border-gray-600'
                      }`}
                    />
                    {errors.custom_pos_type && (
                      <div className="text-xs text-red-400 mt-1">{errors.custom_pos_type}</div>
                    )}
                  </div>
                )}
              </div>

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
              </div>
            </div>
          )}
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
      
      <PopupModal
        open={popup.open}
        onClose={() => setPopup({ ...popup, open: false })}
        title={popup.title}
      >
        <div className="text-center">
          <p className="mb-4">{popup.message}</p>
          {popup.showCancel && (
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setPopup({ ...popup, open: false });
                  popup.onConfirm?.();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                {popup.confirmText || "Confirm"}
              </button>
              <button
                onClick={() => setPopup({ ...popup, open: false })}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                {popup.cancelText || "Cancel"}
              </button>
            </div>
          )}
        </div>
      </PopupModal>
    </div>
  );
}
