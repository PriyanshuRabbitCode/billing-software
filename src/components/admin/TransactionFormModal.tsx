"use client";

import { useEffect, useState } from "react";
import SearchableCustomerInput from "./SearchableCustomerInput";

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
  const [cardOptions, setCardOptions] = useState<Array<{ card_number: string; card_name: string }>>([]);
  const [initialCustomerName, setInitialCustomerName] = useState<string>("");

  // Define the tax and MDR rates structure
  const TAX_MDR_RATES = {
    MP: [
      { tax: 3.50, mdr: 1.50 },
      { tax: 3.00, mdr: 2.00 },
      { tax: 2.80, mdr: 2.00 },
      { tax: 2.00, mdr: 1.50 }
    ],
    PH: [
      { tax: 3.50, mdr: 1.50 },
      { tax: 2.80, mdr: 2.00 },
      { tax: 1.90, mdr: 1.50 }
    ],
    MOS: [
      { tax: 2.80, mdr: 2.00 },
      { tax: 2.50, mdr: 2.00 },
      { tax: 2.00, mdr: 1.50 },
      { tax: 1.80, mdr: 1.50 }
    ]
  };

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
          const res = await fetch(`/api/customers/${initial.customer_id}`);
          const customerData = await res.json();
          setInitialCustomerName(customerData.full_name || "");
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

  // Load card options when customer changes
  useEffect(() => {
    async function loadCardOptions() {
      if (!values.customer_id) {
        setCardOptions([]);
        return;
      }
      
      try {
        const res = await fetch(`/api/customer-cards/${values.customer_id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch cards: ${res.status}`);
        }
        
        const customerCards = await res.json();
        const validCards = customerCards.filter((card: any) => card.card_number);
        setCardOptions(validCards);
        
        if (validCards.length > 0 && !values.card_number) {
          handleChange('card_number', validCards[0].card_number);
          handleChange('card_name', validCards[0].card_name);
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

  // Calculate fees when withdraw amount, POS type, or tax rate changes
  useEffect(() => {
    if (values.withdraw_amount && values.pos_type && values.tax_rate) {
      const withdrawAmount = Number(values.withdraw_amount);
      const posType = values.pos_type;
      const taxRate = Number(values.tax_rate);
      
      // Get available rates for the selected POS type
      const availableRates = TAX_MDR_RATES[posType as keyof typeof TAX_MDR_RATES];
      
      if (availableRates && availableRates.length > 0) {
        // Find the MDR rate for the selected tax rate
        const selectedRate = availableRates.find(rate => rate.tax === taxRate);
        
        if (selectedRate) {
          const taxAmount = (withdrawAmount * taxRate) / 100;
          const mdrChargeAmount = (withdrawAmount * selectedRate.mdr) / 100;
          const profitAmount = taxAmount - mdrChargeAmount;
          
          setValues(prev => ({
            ...prev,
            mdr_amount: selectedRate.mdr.toString(),
            tax_amount: taxAmount.toFixed(2),
            mdr_charge_amount: mdrChargeAmount.toFixed(2),
            profit_amount: profitAmount.toFixed(2)
          }));
        }
      }
    }
  }, [values.withdraw_amount, values.pos_type, values.tax_rate]);

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

  // Handle field change
  const handleChange = (name: string, value: any) => {
    const newValues = { ...values, [name]: value };
    
    // If card_number changes, update card_name if we have that card
    if (name === 'card_number') {
      const selectedCard = cardOptions.find(card => card.card_number === value);
      if (selectedCard) {
        newValues.card_name = selectedCard.card_name;
      }
    }
    
    setValues(newValues);
  };

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
                <label className="block text-xs text-gray-400 mb-1">POS Type</label>
                <select
                  value={values.pos_type}
                  onChange={(e) => handleChange('pos_type', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="">Select POS Type...</option>
                  <option value="MP">MP</option>
                  <option value="PH">PH</option>
                  <option value="MOS">MOS</option>
                </select>
              </div>

              {/* Tax Rate Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Tax Rate (%)</label>
                <select
                  value={values.tax_rate}
                  onChange={(e) => handleChange('tax_rate', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  disabled={!values.pos_type}
                >
                  <option value="">Select Tax Rate...</option>
                  {values.pos_type && TAX_MDR_RATES[values.pos_type as keyof typeof TAX_MDR_RATES]?.map((rate, index) => (
                    <option key={index} value={rate.tax}>
                      {rate.tax}%
                    </option>
                  ))}
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
                />
              </div>

              {/* MDR Amount Field */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">MDR Amount</label>
                <input
                  type="number"
                  value={values.mdr_amount}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  readOnly
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