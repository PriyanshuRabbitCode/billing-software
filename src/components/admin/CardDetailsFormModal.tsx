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
    console.log('Form is active:', isFormActive);
    
    if (!bankName || !cardType) {
      console.log('Missing bank name or card type, clearing available cards');
      setAvailableCards([]);
      return;
    }
    
    const cardOptions = schema.fields.find(f => f.name === 'card_name')?.enumValues || [];
    console.log('Total card options available:', cardOptions.length);
    
    // More flexible filtering logic - be more inclusive to prevent valid cards from being filtered out
    const filtered = cardOptions.filter(card => {
      // Check if card type matches (Credit/Debit)
      const typeMatch = card.toLowerCase().includes(cardType.toLowerCase());
      
      // If card type doesn't match, exclude it
      if (!typeMatch) return false;
      
      // Special handling for common bank abbreviations and names
      const bankAbbreviations: Record<string, string[]> = {
        'State Bank of India': ['SBI', 'State', 'Bank'],
        'HDFC Bank': ['HDFC', 'Bank'],
        'ICICI Bank': ['ICICI', 'Bank'],
        'Punjab National Bank': ['PNB', 'Punjab', 'National', 'Bank'],
        'Bank of Baroda': ['BOB', 'Baroda', 'Bank'],
        'Canara Bank': ['Canara', 'Bank'],
        'Union Bank of India': ['Union', 'Bank'],
        'Axis Bank': ['Axis', 'Bank'],
        'Kotak Mahindra Bank': ['Kotak', 'Mahindra', 'Bank'],
        'IndusInd Bank': ['IndusInd', 'Bank'],
        'Yes Bank': ['Yes', 'Bank'],
        'Federal Bank': ['Federal', 'Bank'],
        'IDBI Bank': ['IDBI', 'Bank'],
        'RBL Bank': ['RBL', 'Bank']
      };
      
      const bankAbbrev = bankAbbreviations[bankName];
      if (bankAbbrev) {
        // Check if any bank abbreviation or word is in the card name
        const hasAbbreviation = bankAbbrev.some(abbrev => 
          card.toUpperCase().includes(abbrev.toUpperCase())
        );
        if (hasAbbreviation) return true;
      }
      
      // Check if bank name has any common words with the card name
      const bankWords = bankName.toLowerCase().split(' ').filter(word => word.length > 2);
      const cardWords = card.toLowerCase().split(' ').filter(word => word.length > 2);
      
      // Check for common words between bank and card name
      const hasCommonWords = bankWords.some(bankWord => 
        cardWords.some(cardWord => 
          cardWord.includes(bankWord) || bankWord.includes(cardWord)
        )
      );
      
      if (hasCommonWords) return true;
      
      // If no specific match found, be more permissive - include cards that might be valid
      // This prevents over-filtering that could exclude legitimate card names
      return true;
    });
    
    console.log('Filtered cards:', filtered);
    console.log('Filtered count:', filtered.length);
    
    // If we have a current card name selected and it's not in the filtered list,
    // but the form is active (user is filling it out), don't clear the available cards
    // This prevents the form from becoming unusable when the user has made selections
    if (isFormActive && values.card_name && filtered.length === 0) {
      console.log('Form is active and user has selected card name, keeping current available cards');
      return;
    }
    
    setAvailableCards(filtered);
    
    // Don't reset card name automatically - let user make the choice
    // This prevents the form from clearing valid selections
  }, [schema.fields, isFormActive, values.card_name]);

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
                <option key={values.card_name} value={values.card_name}>
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
