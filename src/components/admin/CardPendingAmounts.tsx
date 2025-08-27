"use client";
import { useState, useEffect } from "react";
import PaymentModal from "./PaymentModal";

interface CardPendingData {
  cardNumber: string;
  cardName: string;
  customerName: string;
  receivedAmount: number;
  pendingAmount: number;
}

interface CardPendingAmountsProps {
  selectedCustomerId?: string;
}

export default function CardPendingAmounts({ selectedCustomerId }: CardPendingAmountsProps) {
  const [cardPendingData, setCardPendingData] = useState<CardPendingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardPendingData | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const loadCardPendingAmounts = async () => {
    setLoading(true);
    setError("");

    try {
      let url = '/api/cards?include=pending';
      if (selectedCustomerId) {
        url += `&customer_id=${selectedCustomerId}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load card pending amounts');
      }

      // Transform the data to match the expected format
      const transformedData = result.data.map((card: any) => ({
        cardNumber: card.card_number,
        cardName: card.card_name,
        customerName: card.customer?.full_name || 'Unknown',
        pendingAmount: card.pending_amount || 0,
        totalDeposits: card.total_deposits || 0,
        totalWithdrawals: card.total_withdrawals || 0
      }));

      setCardPendingData(transformedData);
    } catch (err: any) {

      setError(err.message || 'Failed to load card pending amounts');
      setCardPendingData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCardPendingAmounts();
  }, [selectedCustomerId]);

  const handlePayClick = (cardData: CardPendingData) => {
    setSelectedCard(cardData);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (cardNumber: string, newPendingAmount: number) => {
    // Update the card data optimistically
    setCardPendingData(prev => 
      prev.map(card => 
        card.cardNumber === cardNumber 
          ? { ...card, pendingAmount: newPendingAmount }
          : card
      )
    );
  };

  const handlePaymentModalClose = () => {
    setPaymentModalOpen(false);
    setSelectedCard(null);
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading card pending amounts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="text-red-400 text-center py-4">
          Error: {error}
          <button 
            onClick={loadCardPendingAmounts}
            className="ml-2 text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (cardPendingData.length === 0) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            {selectedCustomerId 
              ? "This customer has no cards with pending amounts."
              : "No cards with pending amounts found."
            }
          </div>
          {selectedCustomerId && (
            <div className="text-yellow-400 text-sm">
              ⚠️ Selected customer has no cards
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-yellow-400 font-semibold">Card Pending Amounts</h3>
          <button
            onClick={loadCardPendingAmounts}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Card Number</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Card Name</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Received Amount</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Pending Amount</th>
                <th className="text-center py-2 px-2 text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {cardPendingData.map((card, index) => (
                <tr key={card.cardNumber} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="py-3 px-2 text-white">
                    {card.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                  </td>
                  <td className="py-3 px-2 text-white">{card.cardName}</td>
                  <td className="py-3 px-2 text-right text-green-400">
                    {formatCurrency(card.receivedAmount)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={card.pendingAmount > 0 ? 'text-yellow-400' : 'text-green-400'}>
                      {formatCurrency(card.pendingAmount)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {card.pendingAmount > 0 ? (
                      <button
                        onClick={() => handlePayClick(card)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                      >
                        Pay
                      </button>
                    ) : (
                      <span className="text-green-400 text-xs">PAID</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Cards:</span>
            <span className="text-white">{cardPendingData.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Received:</span>
            <span className="text-green-400">
              {formatCurrency(cardPendingData.reduce((sum, card) => sum + card.receivedAmount, 0))}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Pending:</span>
            <span className="text-yellow-400">
              {formatCurrency(cardPendingData.reduce((sum, card) => sum + card.pendingAmount, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedCard && (
        <PaymentModal
          open={paymentModalOpen}
          onClose={handlePaymentModalClose}
          cardData={selectedCard}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
