"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import SearchableCustomerInput from "./SearchableCustomerInput";

/**
 * TransactionFormModal - Add/Edit Transactions
 * 
 * Corrected Transaction Form Flow:
 * Step 1: User selects or types Customer Name
 * Step 2: Load all cards of the selected customer
 * Step 3: Auto-select the first card (if only one card, lock selection; if multiple, user can switch via dropdown)
 * Step 4: Check card settings
 *   - If card has custom defaults (POS Type, Tax Rate %, MDR %) → Auto-fill them from card_details table
 *   - Else → POS Type: Default is shown, user selects from dropdown
 *           Tax Rate %: User selects from dropdown (based on POS Type)
 *           MDR %: System default value is applied
 * Step 5: User enters Deposit Amount & Withdraw Amount
 * Step 6: System dynamically calculates: Tax Amount, MDR Charge Amount, Profit Amount, Payable Amount, Pending Amount
 * Step 7: Form validation (check all required fields, calculations, constraints)
 * Step 8: Submit Transaction
 * 
 * MDR Calculation Logic:
 * - Cards with custom defaults: Use card's MDR value from card_details table
 * - Cards without custom defaults: MDR gets system default value (2.00%)
 * - MDR can be auto-calculated when user manually changes POS Type or Tax Rate
 * 
 * Key Benefits:
 * - No duplicate data entry: Values are fetched from existing card_details table
 * - Consistent with business rules: MDR mapping ensures valid POS Type + Tax Rate combinations
 * - User-friendly: Dropdown selection prevents invalid input
 */

interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  initial: any | null;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  title: string;
}

export default function TransactionFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  title,
}: TransactionFormModalProps) {
  const [values, setValues] = useState<Record<string, any>>({
    customer_id: "",
    card_number: "",
    card_name: "",
    deposit_amount: "",
    withdraw_amount: "",
    payable_amount: "",
    add_tax_to_withdraw: false,
    pos_type: "",
    tax_rate: "",
    tax_amount: "",
    mdr_amount: "",
    mdr_charge_amount: "",
    profit_amount: "",
    pending_amount: "",
    status: ""
  });
  const [loading, setLoading] = useState(false);
  const [cardOptions, setCardOptions] = useState<Array<{ 
    card_number: string; 
    card_name: string;
    enable_defaults?: boolean;
    default_pos_type?: string;
    custom_pos_type?: string;
    default_tax_rate?: number;
    default_mdr_rate?: number;
  }>>([]);
  const [initialCustomerName, setInitialCustomerName] = useState<string>("");

  // MDR Rate mapping based on POS Type and Tax Rate
  const MDR_MAPPING = {
    'MP': {
      '3.50': 1.50,
      '3.00': 2.00,
      '2.80': 2.00,
      '2.00': 1.50
    },
    'PH': {
      '3.50': 1.50,
      '2.80': 2.00,
      '1.90': 1.50
    },
    'MOS': {
      '2.80': 2.00,
      '2.50': 2.00,
      '2.00': 1.50,
      '1.80': 1.50
    }
  };

  // System default values
  const SYSTEM_DEFAULTS = {
    POS_TYPE: 'MP', // Default POS Type
    MDR_RATE: 2.00, // Default MDR Rate (%) - system default
  };

  // Memoize card options to prevent unnecessary re-renders
  const memoizedCardOptions = useMemo(() => cardOptions, [cardOptions]);

  // Function to calculate MDR Rate based on POS Type and Tax Rate
  const calculateMDRRate = useCallback((posType: string, taxRate: string): number | null => {
    if (!posType || !taxRate) return null;
    
    const posMapping = MDR_MAPPING[posType as keyof typeof MDR_MAPPING];
    if (!posMapping) return null;
    
    const mdrRate = posMapping[taxRate as keyof typeof posMapping];
    return mdrRate || null;
  }, []);

  // Function to get available tax rates for a given POS Type
  const getAvailableTaxRates = useCallback((posType: string): string[] => {
    const posMapping = MDR_MAPPING[posType as keyof typeof MDR_MAPPING];
    return posMapping ? Object.keys(posMapping) : [];
  }, []);

  // Handle field change
  const handleChange = useCallback((name: string, value: any) => {
    console.log(`🔄 handleChange called: ${name} = ${value}`);
    console.log(`📝 Previous values:`, values);
    
    setValues(prev => {
      const newValues = { ...prev, [name]: value };
      
      // If card_number changes, update card_name if we have that card
      if (name === 'card_number') {
        const selectedCard = memoizedCardOptions.find(card => card.card_number === value);
        if (selectedCard) {
          newValues.card_name = selectedCard.card_name;
        }
      }
      
      // Special handling for Tax Rate changes
      if (name === 'tax_rate') {
        console.log('💰 Tax Rate changed to:', value);
        console.log('🎯 Current POS Type:', newValues.pos_type);
        if (newValues.pos_type) {
          const calculatedMDR = calculateMDRRate(newValues.pos_type, value);
          console.log('🧮 Calculated MDR for new Tax Rate:', calculatedMDR);
        }
      }
      
      console.log(`✅ New values after ${name} change:`, newValues);
      return newValues;
    });
  }, [memoizedCardOptions, values, calculateMDRRate]);

  // Initialize form values
  useEffect(() => {
    if (initial) {
      setValues({
        customer_id: initial.customer_id || "",
        card_number: initial.card_number || "",
        card_name: initial.card_name || "",
        deposit_amount: initial.deposit_amount || "",
        withdraw_amount: initial.withdraw_amount || "",
        payable_amount: initial.payable_amount || initial.withdraw_amount || "",
        add_tax_to_withdraw: initial.add_tax_to_withdraw || false,
        pos_type: initial.pos_type || "",
        tax_rate: initial.tax_rate || "",
        tax_amount: initial.tax_amount || "",
        mdr_amount: initial.mdr_amount || "",
        mdr_charge_amount: initial.mdr_charge_amount || "",
        profit_amount: initial.profit_amount || "",
        pending_amount: initial.pending_amount || "",
        status: initial.status || ""
      });
    } else {
      setValues({
        customer_id: "",
        card_number: "",
        card_name: "",
        deposit_amount: "",
        withdraw_amount: "",
        payable_amount: "",
        add_tax_to_withdraw: false,
        pos_type: "",
        tax_rate: "",
        tax_amount: "",
        mdr_amount: "",
        mdr_charge_amount: "",
        profit_amount: "",
        pending_amount: "",
        status: ""
      });
    }
    }, [initial, open]);

  // Load initial customer name when editing
  useEffect(() => {
    async function loadInitialCustomerName() {
      if (initial?.customer_id && open) {
        try {
          const res = await fetch(`/api/customers?id=${initial.customer_id}`);
          const result = await res.json();
          const customerData = result.data[0];
          setInitialCustomerName(customerData?.full_name || "");
        } catch (err) {
          console.error('Error loading initial customer name:', err);
          setInitialCustomerName("");
        }
      } else {
          setInitialCustomerName("");
        }
      }
      
      loadInitialCustomerName();
    }, [initial?.customer_id, open]);

  // Debug: Log when values change
  useEffect(() => {
    console.log('🔄 Values changed:', {
      customer_id: values.customer_id,
      card_number: values.card_number,
      pos_type: values.pos_type,
      tax_rate: values.tax_rate,
      mdr_amount: values.mdr_amount
    });
    
    // Log the actual form field values to see if they're being updated
    console.log('📊 Current form state:', {
      pos_type: values.pos_type,
      tax_rate: values.tax_rate,
      mdr_amount: values.mdr_amount,
      pos_type_length: values.pos_type?.length || 0,
      tax_rate_length: values.tax_rate?.length || 0,
      mdr_amount_length: values.mdr_amount?.length || 0
    });
  }, [values.customer_id, values.card_number, values.pos_type, values.tax_rate, values.mdr_amount]);

  // Load card options when customer changes
  useEffect(() => {
    async function loadCardOptions() {
      if (!values.customer_id) {
        setCardOptions([]);
        return;
      }
      
      try {
        const res = await fetch(`/api/cards?customer_id=${values.customer_id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch cards: ${res.status}`);
        }
        
        const result = await res.json();
        const customerCards = result.data || [];
        const validCards = customerCards.filter((card: any) => card.card_number) as Array<{
          card_number: string;
          card_name: string;
          enable_defaults?: boolean;
          default_pos_type?: string;
          custom_pos_type?: string;
          default_tax_rate?: number;
          default_mdr_rate?: number;
        }>;

        console.log('Valid cards found:', validCards.length);
        console.log('🔍 Raw card data from API:', validCards);
        console.log('Card details:', validCards.map(card => ({
          card_number: card.card_number,
          card_name: card.card_name,
          enable_defaults: card.enable_defaults,
          default_pos_type: card.default_pos_type,
          custom_pos_type: card.custom_pos_type,
          default_tax_rate: card.default_tax_rate,
          default_mdr_rate: card.default_mdr_rate,
          default_tax_rate_type: typeof card.default_tax_rate,
          default_mdr_rate_type: typeof card.default_mdr_rate
        })));
        
        // Check if any card has custom defaults
        const hasCustomDefaults = validCards.some(card => card.enable_defaults);
        console.log('Has cards with custom defaults:', hasCustomDefaults);
        
        setCardOptions(validCards);
        
                if (validCards.length > 0 && !values.card_number) {
          // Find the first card with custom defaults, or fall back to the first card
          const cardWithDefaults = validCards.find(card => card.enable_defaults) || validCards[0];
          const selectedCard = cardWithDefaults;
          
          console.log('Selected card for auto-fill:', {
            card_number: selectedCard.card_number,
            card_name: selectedCard.card_name,
            enable_defaults: selectedCard.enable_defaults,
            default_pos_type: selectedCard.default_pos_type,
            custom_pos_type: selectedCard.custom_pos_type,
            default_tax_rate: selectedCard.default_tax_rate,
            default_mdr_rate: selectedCard.default_mdr_rate
          });
          
          // Set card number, name, and defaults in a single setValues call
          console.log('About to call setValues for initial card loading...');
          setValues(prev => {
            console.log('setValues callback executed with prev:', prev);
            const updates: Record<string, any> = {
              card_number: selectedCard.card_number,
              card_name: selectedCard.card_name
            };
            
            // Step 4: Check card settings and apply appropriate defaults
            if (selectedCard.enable_defaults) {
              // Card has custom defaults - auto-fill them
              console.log('Selected card has custom defaults, auto-filling...');
              console.log('Selected card details:', {
                enable_defaults: selectedCard.enable_defaults,
                default_pos_type: selectedCard.default_pos_type,
                custom_pos_type: selectedCard.custom_pos_type,
                default_tax_rate: selectedCard.default_tax_rate,
                default_mdr_rate: selectedCard.default_mdr_rate
              });
              
              if (selectedCard.default_pos_type) {
                // If POS Type is "Custom", use the custom_pos_type value
                if (selectedCard.default_pos_type === 'Custom' && selectedCard.custom_pos_type) {
                  updates.pos_type = selectedCard.custom_pos_type;
                  console.log('Using custom POS Type from selected card:', selectedCard.custom_pos_type);
                } else {
                  updates.pos_type = selectedCard.default_pos_type;
                  console.log('Using predefined POS Type from selected card:', selectedCard.default_pos_type);
                }
              }
              if (selectedCard.default_tax_rate !== null && selectedCard.default_tax_rate !== undefined) {
                updates.tax_rate = selectedCard.default_tax_rate.toString();
                console.log('Using default Tax Rate from selected card:', selectedCard.default_tax_rate);
              }
              if (selectedCard.default_mdr_rate !== null && selectedCard.default_mdr_rate !== undefined) {
                updates.mdr_amount = selectedCard.default_mdr_rate.toString();
                console.log('Using default MDR Rate from selected card:', selectedCard.default_mdr_rate);
              }
            } else {
              // Card has no custom defaults - apply system defaults
              console.log('Selected card has no custom defaults, applying system defaults...');
              updates.pos_type = SYSTEM_DEFAULTS.POS_TYPE;
              updates.mdr_amount = SYSTEM_DEFAULTS.MDR_RATE.toString(); // Apply system default MDR
              // Tax Rate % remains empty - user must select manually
            }
            
            // Card defaults applied successfully
            
            const newValues = { ...prev, ...updates };
            console.log('Initial card loading - Final values:', newValues);
            return newValues;
          });
        }
      } catch (err) {
        console.error('Error loading card options:', err);
        setCardOptions([]);
      }
    }
    
    if (values.customer_id) {
      loadCardOptions();
    }
  }, [values.customer_id]);

    // Auto-fill default values when card is selected
  useEffect(() => {
    console.log('Card selection effect triggered:', {
      card_number: values.card_number,
      memoizedCardOptions_length: memoizedCardOptions.length,
      memoizedCardOptions: memoizedCardOptions
    });
    
    if (values.card_number && memoizedCardOptions.length > 0) {
      const selectedCard = memoizedCardOptions.find(card => card.card_number === values.card_number);
      
      console.log('Card selected for transaction:', {
        card_number: selectedCard?.card_number,
        enable_defaults: selectedCard?.enable_defaults,
        default_pos_type: selectedCard?.default_pos_type,
        custom_pos_type: selectedCard?.custom_pos_type,
        default_tax_rate: selectedCard?.default_tax_rate,
        default_mdr_rate: selectedCard?.default_mdr_rate
      });
      
      if (selectedCard && selectedCard.enable_defaults) {
        // Card has custom defaults - auto-fill them
        console.log('Auto-filling from card defaults...');
        console.log('Selected card details:', {
          enable_defaults: selectedCard.enable_defaults,
          default_pos_type: selectedCard.default_pos_type,
          custom_pos_type: selectedCard.custom_pos_type,
          default_tax_rate: selectedCard.default_tax_rate,
          default_mdr_rate: selectedCard.default_mdr_rate
        });
        
        setValues(prev => {
          const updates: Record<string, any> = {};
          
          if (selectedCard.default_pos_type) {
            // If POS Type is "Custom", use the custom_pos_type value
            if (selectedCard.default_pos_type === 'Custom' && selectedCard.custom_pos_type) {
              updates.pos_type = selectedCard.custom_pos_type;
              console.log('Using custom POS Type:', selectedCard.custom_pos_type);
            } else {
              updates.pos_type = selectedCard.default_pos_type;
              console.log('Using predefined POS Type:', selectedCard.default_pos_type);
            }
          }
          if (selectedCard.default_tax_rate !== null && selectedCard.default_tax_rate !== undefined) {
            updates.tax_rate = selectedCard.default_tax_rate.toString();
            console.log('Using default Tax Rate:', selectedCard.default_tax_rate);
          }
          if (selectedCard.default_mdr_rate !== null && selectedCard.default_mdr_rate !== undefined) {
            updates.mdr_amount = selectedCard.default_mdr_rate.toString();
            console.log('Using default MDR Rate:', selectedCard.default_mdr_rate);
          }
          
          console.log('Final updates object:', updates);
          console.log('Previous values:', prev);
          const newValues = { ...prev, ...updates };
          console.log('New values after update:', newValues);
          return newValues;
        });
      } else if (selectedCard && !selectedCard.enable_defaults) {
        // Card has no custom defaults - apply system defaults
        console.log('Applying system defaults...');
        setValues(prev => ({
          ...prev,
          pos_type: SYSTEM_DEFAULTS.POS_TYPE,
          tax_rate: '', // User must select manually
          mdr_amount: SYSTEM_DEFAULTS.MDR_RATE.toString() // Apply system default MDR
        }));
      }
    }
  }, [values.card_number, memoizedCardOptions]);

  // Auto-fill fields when "Custom" POS Type is selected
  const customAutoFillProcessed = useRef(false);
  
  useEffect(() => {
    console.log('🔍 POS Type change detected:', {
      pos_type: values.pos_type,
      card_number: values.card_number,
      memoizedCardOptions_length: memoizedCardOptions.length,
      customAutoFillProcessed: customAutoFillProcessed.current
    });
    
    if (values.pos_type === 'Custom' && values.card_number && memoizedCardOptions.length > 0 && !customAutoFillProcessed.current) {
      const selectedCard = memoizedCardOptions.find(card => card.card_number === values.card_number);
      
      console.log('✅ Custom POS Type selected, auto-filling from card defaults...');
      console.log('📋 Selected card details:', {
        card_number: selectedCard?.card_number,
        card_name: selectedCard?.card_name,
        enable_defaults: selectedCard?.enable_defaults,
        default_pos_type: selectedCard?.default_pos_type,
        custom_pos_type: selectedCard?.custom_pos_type,
        default_tax_rate: selectedCard?.default_tax_rate,
        default_mdr_rate: selectedCard?.default_mdr_rate,
        default_tax_rate_type: typeof selectedCard?.default_tax_rate,
        default_mdr_rate_type: typeof selectedCard?.default_mdr_rate
      });
      
      if (selectedCard) {
        console.log('🎯 Card found, proceeding with auto-fill...');
        
        // Mark as processed to prevent infinite loops
        customAutoFillProcessed.current = true;
        
        const updates: Record<string, any> = {};
        
        // Use the card's custom POS Type value
        if (selectedCard.custom_pos_type) {
          updates.pos_type = selectedCard.custom_pos_type;
          console.log('🔄 Setting POS Type to custom value:', selectedCard.custom_pos_type);
        } else {
          console.log('❌ No custom_pos_type found in card');
        }
        
        // Use the card's default Tax Rate
        console.log('🔍 Checking default_tax_rate:', {
          value: selectedCard.default_tax_rate,
          type: typeof selectedCard.default_tax_rate,
          isNull: selectedCard.default_tax_rate === null,
          isUndefined: selectedCard.default_tax_rate === undefined,
          isString: typeof selectedCard.default_tax_rate === 'string',
          isNumber: typeof selectedCard.default_tax_rate === 'number'
        });
        
        if (selectedCard.default_tax_rate !== null && selectedCard.default_tax_rate !== undefined) {
          updates.tax_rate = selectedCard.default_tax_rate.toString();
          console.log('✅ Setting Tax Rate to card default:', selectedCard.default_tax_rate);
        } else {
          console.log('❌ Tax Rate not set - value is null/undefined');
        }
        
        // Use the card's default MDR Rate
        console.log('🔍 Checking default_mdr_rate:', {
          value: selectedCard.default_mdr_rate,
          type: typeof selectedCard.default_mdr_rate,
          isNull: selectedCard.default_mdr_rate === null,
          isUndefined: selectedCard.default_mdr_rate === undefined,
          isString: typeof selectedCard.default_mdr_rate === 'string',
          isNumber: typeof selectedCard.default_mdr_rate === 'number'
        });
        
        if (selectedCard.default_mdr_rate !== null && selectedCard.default_mdr_rate !== undefined) {
          updates.mdr_amount = selectedCard.default_mdr_rate.toString();
          console.log('✅ Setting MDR to card default:', selectedCard.default_mdr_rate);
        } else {
          console.log('❌ MDR not set - value is null/undefined');
        }
        
        console.log('📊 Final updates object:', updates);
        console.log('🔢 Number of updates:', Object.keys(updates).length);
        
        // Only update if we have values to set
        if (Object.keys(updates).length > 0) {
          console.log('🚀 Calling setValues with updates:', updates);
          setValues(prev => {
            console.log('📝 Previous values before update:', prev);
            const newValues = { ...prev, ...updates };
            console.log('🆕 New values after custom auto-fill:', newValues);
            return newValues;
          });
        } else {
          console.log('❌ No updates to apply - updates object is empty');
        }
      } else {
        console.log('❌ No card found for auto-fill');
      }
    } else if (values.pos_type !== 'Custom') {
      // Reset the flag when POS Type changes to something other than Custom
      console.log('🔄 Resetting customAutoFillProcessed flag - POS Type changed from Custom');
      customAutoFillProcessed.current = false;
    } else {
      console.log('❌ Custom auto-fill conditions not met:', {
        pos_type_is_custom: values.pos_type === 'Custom',
        has_card_number: !!values.card_number,
        has_card_options: memoizedCardOptions.length > 0,
        already_processed: customAutoFillProcessed.current
      });
    }
  }, [values.pos_type, values.card_number, memoizedCardOptions]);

  // Auto-calculate MDR Rate when POS Type or Tax Rate changes
  useEffect(() => {
    console.log('🎯 MDR Calculation Effect triggered:', {
      pos_type: values.pos_type,
      tax_rate: values.tax_rate,
      has_both: !!(values.pos_type && values.tax_rate)
    });
    
    if (values.pos_type && values.tax_rate) {
      const calculatedMDR = calculateMDRRate(values.pos_type, values.tax_rate);
      
      if (calculatedMDR !== null) {
        console.log('🔄 MDR Auto-calculation triggered:', {
          pos_type: values.pos_type,
          tax_rate: values.tax_rate,
          calculated_mdr: calculatedMDR,
          current_mdr: values.mdr_amount
        });
        
        // Always update MDR when POS Type or Tax Rate changes
        // This ensures MDR stays in sync with the selected combination
        setValues(prev => {
          console.log('📝 Updating MDR from', prev.mdr_amount, 'to', calculatedMDR.toString());
          return {
            ...prev,
            mdr_amount: calculatedMDR.toString()
          };
        });
      } else {
        console.log('❌ No MDR mapping found for:', {
          pos_type: values.pos_type,
          tax_rate: values.tax_rate
        });
      }
    }
  }, [values.pos_type, values.tax_rate, calculateMDRRate]);

  // Update payable amount when withdraw amount or tax checkbox changes
  useEffect(() => {
    if (values.withdraw_amount) {
      const withdrawAmount = Number(values.withdraw_amount);
      const taxAmount = Number(values.tax_amount) || 0;
      
      let payableAmount = withdrawAmount;
      
      if (values.add_tax_to_withdraw) {
        // If checkbox is checked, add tax amount to payable amount
        payableAmount = withdrawAmount + taxAmount;
      }
      
      setValues(prev => ({
        ...prev,
        payable_amount: payableAmount.toFixed(2)
      }));
    }
  }, [values.withdraw_amount, values.tax_amount, values.add_tax_to_withdraw]);

  // Calculate Tax Amount and MDR Charge Amount based on Tax Rate %, MDR %, and Withdraw Amount
  useEffect(() => {
    const withdrawAmount = Number(values.withdraw_amount) || 0;
    const taxRate = Number(values.tax_rate) || 0;
    const mdrRate = Number(values.mdr_amount) || 0;
    
    // Calculate Tax Amount: (Tax Rate % × Withdraw Amount) / 100
    const taxAmount = (taxRate * withdrawAmount) / 100;
    
    // Calculate MDR Charge Amount: (MDR % × Withdraw Amount) / 100
    const mdrChargeAmount = (mdrRate * withdrawAmount) / 100;
    
    // Calculate Profit Amount: Tax Amount - MDR Charge Amount
    const profitAmount = taxAmount - mdrChargeAmount;
    
    setValues(prev => ({
      ...prev,
      tax_amount: taxAmount > 0 ? taxAmount.toFixed(2) : "",
      mdr_charge_amount: mdrChargeAmount > 0 ? mdrChargeAmount.toFixed(2) : "",
      profit_amount: profitAmount > 0 ? profitAmount.toFixed(2) : ""
    }));
  }, [values.withdraw_amount, values.tax_rate, values.mdr_amount]);

  // Calculate pending amount
  useEffect(() => {
    const deposit = Number(values.deposit_amount) || 0;
    const withdraw = Number(values.withdraw_amount) || 0;
    const taxAmount = Number(values.tax_amount) || 0;
    
    let pending = 0;
    
    if (values.add_tax_to_withdraw) {
      // If checkbox is checked: Tax amount is added to Payable Amount
      // Pending amount = Deposit Amount - Withdraw Amount
      pending = deposit - withdraw;
    } else {
      // If checkbox is not checked: Tax amount is added to Pending Amount
      // Pending amount = (Deposit Amount - Withdraw Amount) + Tax Amount
      pending = (deposit - withdraw) + taxAmount;
    }
    
    let status = "";
    if (pending > 0) {
      status = "Pending";
    } else if (pending < 0) {
      status = "Overpaid";
    } else {
      // When pending = 0, status should be "PAID"
      status = "PAID";
    }
    
    setValues(prev => ({
      ...prev,
      pending_amount: pending.toFixed(2),
      status: status
    }));
  }, [values.deposit_amount, values.withdraw_amount, values.tax_amount, values.add_tax_to_withdraw]);

  // Validate form
  const validateForm = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check if at least one amount is provided
    if (!values.deposit_amount && !values.withdraw_amount) {
      errors.push("At least one amount (deposit or withdraw) is required");
    }
    
    // Check if withdraw amount is greater than deposit amount
    const deposit = Number(values.deposit_amount) || 0;
    const withdraw = Number(values.withdraw_amount) || 0;
    
    if (withdraw > deposit) {
      errors.push("Withdraw Amount cannot be greater than Deposit Amount");
    }
    
    // Check if customer is selected
    if (!values.customer_id) {
      errors.push("Customer selection is required");
    }
    
    // Check if card is selected
    if (!values.card_number) {
      errors.push("Card selection is required");
    }
    
    // Check if POS type and tax rate are provided when withdraw amount is present
    if (withdraw > 0) {
      if (!values.pos_type) {
        errors.push("POS Type is required for withdraw transactions");
      }
      if (!values.tax_rate) {
        errors.push("Tax Rate is required for withdraw transactions");
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Submit form
  const submit = async () => {
    const validation = validateForm();
    
    if (!validation.isValid) {
      alert(`Validation Error:\n${validation.errors.join('\n')}`);
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      if (error instanceof Error) {
        alert(`Error saving transaction: ${error.message}`);
      } else {
        alert('Error saving transaction: Failed to save transaction.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-6xl bg-gray-900 text-gray-100 rounded-lg border border-gray-800 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Customer and Card Selection Section */}
          <div className="border-2 border-purple-500 rounded-lg p-4 bg-gray-800">
            <h4 className="text-purple-400 font-semibold mb-4 text-center">Customer & Card Selection</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Customer</label>
                <SearchableCustomerInput
                  onChange={(customerId) => handleChange('customer_id', customerId)}
                  placeholder="Search customers by name, email, or phone..."
                  initialCustomerName={initialCustomerName}
                />
              </div>

              {/* Card Number Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Card Number</label>
                <select
                  value={values.card_number}
                  onChange={(e) => handleChange('card_number', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  disabled={!values.customer_id}
                >
                  <option value="">Select Card...</option>
                  {cardOptions.map((card) => (
                    <option key={card.card_number} value={card.card_number}>
                      {card.card_number} - {card.card_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Card Name Field */}
              <div className="mb-4 md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Card Name</label>
                <input
                  type="text"
                  value={values.card_name}
                  onChange={(e) => handleChange('card_name', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly={!!values.card_number}
                  placeholder="Card name will be auto-filled when card is selected"
                />
              </div>
            </div>
          </div>

          {/* Amount Section */}
          <div className="border-2 border-blue-500 rounded-lg p-4 bg-gray-800">
            <h4 className="text-blue-400 font-semibold mb-4 text-center">Transaction Amounts</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deposit Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Deposit Amount (Base Amount)</label>
                <input
                  type="number"
                  value={values.deposit_amount}
                  onChange={(e) => handleChange('deposit_amount', e.target.value)}
                  className={`w-full bg-gray-700 border rounded px-3 py-2 text-white ${
                    Number(values.withdraw_amount) > Number(values.deposit_amount) 
                      ? 'border-red-500' 
                      : 'border-gray-600'
                  }`}
                  placeholder="0.00"
                  step="0.01"
                />
                {Number(values.withdraw_amount) > Number(values.deposit_amount) && (
                  <div className="text-xs text-red-400 mt-1">
                    Deposit amount must be greater than or equal to withdraw amount
                  </div>
                )}
              </div>

              {/* Withdraw Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Withdraw Amount (Base Amount)</label>
                <input
                  type="number"
                  value={values.withdraw_amount}
                  onChange={(e) => handleChange('withdraw_amount', e.target.value)}
                  className={`w-full bg-gray-700 border rounded px-3 py-2 text-white ${
                    Number(values.withdraw_amount) > Number(values.deposit_amount) 
                      ? 'border-red-500' 
                      : 'border-gray-600'
                  }`}
                  placeholder="0.00"
                  step="0.01"
                />
                {Number(values.withdraw_amount) > Number(values.deposit_amount) && (
                  <div className="text-xs text-red-400 mt-1">
                    Withdraw amount cannot be greater than deposit amount
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Withdraw Transaction Section */}
          <div className="border-2 border-green-500 rounded-lg p-4 bg-gray-800">
            <h4 className="text-green-400 font-semibold mb-4 text-center">Withdraw Transaction Details</h4>
            
            {/* Mode Indicator */}
            {values.card_number && (
              <div className="mb-4 p-3 rounded-lg bg-gray-700 border border-gray-600">
                {memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults ? (
                  <div className="flex items-center text-blue-400 text-sm">
                    <span className="mr-2">🔄</span>
                    <span>Auto-fill Mode: Using card defaults for POS Type, Tax Rate %, and MDR %</span>
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-400 text-sm">
                    <span className="mr-2">✋</span>
                    <span>Manual Mode: Select POS Type and Tax Rate % manually, MDR % will be auto-calculated</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payable Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Payable Amount</label>
                <input
                  type="number"
                  value={values.payable_amount}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              {/* Add Tax to Withdraw Checkbox */}
              <div className="mb-4 flex items-center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.add_tax_to_withdraw}
                    onChange={(e) => handleChange('add_tax_to_withdraw', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Add Tax Amount to Withdraw Amount</span>
                </label>
              </div>

              {/* POS Type Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">
                  POS Type
                  {values.pos_type && memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && 
                   memoizedCardOptions.find(card => card.card_number === values.card_number)?.default_pos_type === values.pos_type && (
                    <span className="ml-2 text-xs text-blue-400">(Auto-filled from card defaults)</span>
                  )}
                  {values.pos_type && values.pos_type === SYSTEM_DEFAULTS.POS_TYPE && 
                   (!memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults || 
                    !memoizedCardOptions.find(card => card.card_number === values.card_number)?.default_pos_type) && (
                    <span className="ml-2 text-xs text-green-400">(System default)</span>
                  )}
                  {values.pos_type && values.pos_type !== "" && values.pos_type !== "MP" && values.pos_type !== "PH" && values.pos_type !== "MOS" && values.pos_type !== "Custom" && (
                    <span className="ml-2 text-xs text-blue-400">(Custom from card: {values.pos_type})</span>
                  )}
                  {values.card_number && !memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && (
                    <span className="ml-2 text-xs text-yellow-400">(Manual selection required)</span>
                  )}
                </label>
                <select
                  value={values.pos_type}
                  onChange={(e) => handleChange('pos_type', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="">Select POS Type</option>
                  {/* Always show the current POS Type first if it's set (for custom card defaults) */}
                  {values.pos_type && values.pos_type !== "" && values.pos_type !== "MP" && values.pos_type !== "PH" && values.pos_type !== "MOS" && values.pos_type !== "Custom" && (
                    <option key={values.pos_type} value={values.pos_type}>{values.pos_type} (Custom from Card)</option>
                  )}
                  <option value="MP">MP (Default)</option>
                  <option value="PH">PH</option>
                  <option value="MOS">MOS</option>
                  {/* Only show "Custom" option if the selected card has enable_defaults = true */}
                  {values.card_number && memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && (
                    <option value="Custom">Custom (Use Card Defaults)</option>
                  )}
                </select>

              </div>

              {/* Tax Rate Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">
                  Tax Rate (%) *
                  {values.tax_rate && memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && 
                   memoizedCardOptions.find(card => card.card_number === values.card_number)?.default_tax_rate?.toString() === values.tax_rate && (
                    <span className="ml-2 text-xs text-blue-400">(Auto-filled from card defaults)</span>
                  )}
                  {values.tax_rate && values.tax_rate !== "" && (
                    <span className="ml-2 text-xs text-green-400">(Current: {values.tax_rate}%)</span>
                  )}
                  {!values.tax_rate && (
                    <span className="ml-2 text-xs text-yellow-400">(Manual selection required)</span>
                  )}
                  {values.pos_type && !values.tax_rate && (
                    <div className="text-xs text-gray-500 mt-1">
                      Available for {values.pos_type}: {getAvailableTaxRates(values.pos_type).join(', ')}%
                    </div>
                  )}
                  {values.card_number && !memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && (
                    <span className="ml-2 text-xs text-yellow-400">(Manual selection required)</span>
                  )}
                </label>
                <select
                  value={values.tax_rate}
                  onChange={(e) => handleChange('tax_rate', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  disabled={!!(values.tax_rate && memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && 
                               memoizedCardOptions.find(card => card.card_number === values.card_number)?.default_tax_rate?.toString() === values.tax_rate)}
                >
                  <option value="">Select Tax Rate</option>
                  {/* Always show the current tax rate first if it's set (for custom card defaults) */}
                  {values.tax_rate && values.tax_rate !== "" && (
                    <option key={values.tax_rate} value={values.tax_rate}>{values.tax_rate}%</option>
                  )}
                  {/* Show available tax rates for the selected POS Type */}
                  {values.pos_type && getAvailableTaxRates(values.pos_type)
                    .filter(rate => rate !== values.tax_rate) // Don't duplicate the current value
                    .map(rate => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))
                  }
                </select>

              </div>

              {/* Tax Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Tax Amount</label>
                <input
                  type="number"
                  value={values.tax_amount}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly
                  placeholder="Auto-calculated based on Tax Rate % and Withdraw Amount"
                />
              </div>

              {/* MDR % Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">
                  MDR %
                  {values.mdr_amount && memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && 
                   memoizedCardOptions.find(card => card.card_number === values.card_number)?.default_mdr_rate?.toString() === values.mdr_amount && (
                    <span className="ml-2 text-xs text-blue-400">(Auto-filled from card defaults)</span>
                  )}
                  {values.mdr_amount && values.mdr_amount === SYSTEM_DEFAULTS.MDR_RATE.toString() && 
                   !memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && (
                    <span className="ml-2 text-xs text-green-400">(System default)</span>
                  )}
                  {values.mdr_amount && values.mdr_amount !== SYSTEM_DEFAULTS.MDR_RATE.toString() && 
                   !memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && 
                   calculateMDRRate(values.pos_type, values.tax_rate)?.toString() === values.mdr_amount && (
                    <span className="ml-2 text-xs text-blue-400">(Auto-calculated from POS Type + Tax Rate)</span>
                  )}
                </label>
                <input
                  type="number"
                  value={values.mdr_amount}
                  onChange={(e) => handleChange('mdr_amount', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly={!!(values.mdr_amount && memoizedCardOptions.find(card => card.card_number === values.card_number)?.enable_defaults && 
                               memoizedCardOptions.find(card => card.card_number === values.card_number)?.default_mdr_rate?.toString() === values.mdr_amount)}
                  placeholder="System default, card defaults, or auto-calculated from POS Type + Tax Rate"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>

              {/* MDR Charge Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">MDR Charge Amount</label>
                <input
                  type="number"
                  value={values.mdr_charge_amount}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly
                  placeholder="Auto-calculated based on MDR % and Withdraw Amount"
                />
              </div>

              {/* Profit Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Profit Amount</label>
                <input
                  type="number"
                  value={values.profit_amount}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly
                  placeholder="Auto-calculated: Tax Amount - MDR Charge Amount"
                />
              </div>
            </div>
          </div>

          {/* Pending Amount Calculation Section */}
          <div className="border-2 border-orange-500 rounded-lg p-4 bg-gray-800">
            <h4 className="text-orange-400 font-semibold mb-4 text-center">Pending Amount Calculation</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pending Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Pending Amount</label>
                <input
                  type="number"
                  value={values.pending_amount}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-semibold"
                  readOnly
                />
              </div>

              {/* Status Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <input
                  type="text"
                  value={values.status}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-semibold"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded bg-gray-700 border border-gray-600 hover:bg-gray-600">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || Number(values.withdraw_amount) > Number(values.deposit_amount)}
            className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 font-semibold"
          >
            {loading ? "Saving..." : "Save Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}