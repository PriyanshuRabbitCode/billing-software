"use client";
import { useState, useEffect } from "react";
import { useToastHelpers } from "@/components/ui/Toast";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  cardData: {
    card_number: string;
    card_name: string;
    customer_id: number;
    customer_name: string;
    pending_amount: number;
    received_amount: number;
  };
  onPaymentSuccess: (cardNumber: string, newPendingAmount: number) => void;
}

export default function PaymentModal({ 
  open, 
  onClose, 
  cardData, 
  onPaymentSuccess 
}: PaymentModalProps) {
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const { success, error: showError } = useToastHelpers();

  // Auto-fill pending amount when modal opens
  useEffect(() => {
    if (open && cardData) {
      setPaidAmount(cardData.pending_amount.toString());
    }
  }, [open, cardData]);

  const paymentModes = [
    { value: "UPI", label: "UPI" },
    { value: "Card", label: "Card" },
    { value: "Cash", label: "Cash" },
    { value: "Net Banking", label: "Net Banking" }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentMode) {
      setError("Please select a payment mode");
      return;
    }

    if (!paidAmount || parseFloat(paidAmount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const amount = parseFloat(paidAmount);
    
    if (amount > cardData.pending_amount) {
      setError(`Amount cannot be greater than pending amount (${formatCurrency(cardData.pending_amount)})`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardNumber: cardData.card_number,
          customerId: cardData.customer_id,
          paymentMode,
          paidAmount: amount
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment failed');
      }

      // Payment successful
      onPaymentSuccess(cardData.card_number, result.data.newPendingAmount);
      
      // Show success message
      success('Pending amount has been successfully paid.');
      
      onClose();
      
      // Reset form
      setPaymentMode("");
      setPaidAmount("");
      setError("");
      
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      showError('Failed to process payment. Please try again.', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPaymentMode("");
      setPaidAmount("");
      setError("");
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-md bg-gray-900 text-gray-100 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Payment Details</h3>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-white text-xl"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Information */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Card Information</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Card Number:</span>
                <span className="ml-2 text-white">{cardData.card_number}</span>
              </div>
              <div>
                <span className="text-gray-400">Card Name:</span>
                <span className="ml-2 text-white">{cardData.card_name}</span>
              </div>
              <div>
                <span className="text-gray-400">Customer Name:</span>
                <span className="ml-2 text-white">{cardData.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-400">Pending Amount:</span>
                <span className="ml-2 text-yellow-400 font-medium">
                  {formatCurrency(cardData.pending_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Mode of Payment *
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              disabled={loading}
              required
            >
              <option value="">Select Payment Mode...</option>
              {paymentModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Amount to Pay *
            </label>
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              max={cardData.pending_amount}
              disabled={loading}
              required
            />
            <div className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(cardData.pending_amount)}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded px-3 py-2 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !paymentMode || !paidAmount}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Confirm Payment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
