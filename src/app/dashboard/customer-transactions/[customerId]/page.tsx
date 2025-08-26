"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Filter } from "lucide-react";

interface Transaction {
  id: number;
  customer_id: number;
  card_number: string;
  card_name: string;
  deposit_amount: number;
  withdraw_amount: number;
  payable_amount: number;
  pos_type: string;
  tax_rate: number;
  tax_amount: number;
  mdr_amount: number;
  mdr_charge_amount: number;
  profit_amount: number;
  add_tax_to_withdraw: boolean;
  pending_amount: number;
  status: string;
  transaction_date: string;
  created_at: string;
}

interface Card {
  card_number: string;
  card_name: string;
}

export default function CustomerTransactionsPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [error, setError] = useState<string>("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getLastFourDigits = (cardNumber: string) => {
    if (!cardNumber) return "—";
    return cardNumber.replace(/\s/g, '').slice(-4);
  };

  const loadData = useCallback(async () => {
    if (!customerId) return;
    
    setLoading(true);
    setError("");

    try {
      // Load customer data
      const customerRes = await fetch(`/api/customers/${customerId}`);
      const customerData = await customerRes.json();
      setCustomer(customerData);

      // Load transactions
      const transactionsRes = await fetch(`/api/transactions?customer_id=${customerId}`);
      const transactionsData = await transactionsRes.json();
      setTransactions(transactionsData);

      // Load customer cards
      const cardsRes = await fetch(`/api/customer-cards/${customerId}`);
      const cardsData = await cardsRes.json();
      setCards(cardsData);

    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter transactions based on selected card
  const filteredTransactions = selectedCard 
    ? transactions.filter(tx => tx.card_number === selectedCard)
    : transactions;

  const handleBack = () => {
    window.location.href = `/dashboard/customers`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-400">Loading transactions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-center">
          <p>Error: {error}</p>
          <button 
            onClick={loadData}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-semibold">
                {customer?.full_name || 'Customer'} - All Transactions
              </h1>
              <p className="text-gray-400 text-sm">
                {transactions.length} transactions found
              </p>
            </div>
          </div>
        </div>

        {/* Card Filter */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-blue-500" />
            <label className="text-sm text-gray-300">Filter by Card:</label>
            <select
              value={selectedCard}
              onChange={(e) => setSelectedCard(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Cards</option>
              {cards.map((card) => (
                <option key={card.card_number} value={card.card_number}>
                  {card.card_name} (**** **** **** {getLastFourDigits(card.card_number)})
                </option>
              ))}
            </select>
            {selectedCard && (
              <button
                onClick={() => setSelectedCard("")}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Card Number</th>
                  <th className="px-4 py-3 text-left">Card Name</th>
                  <th className="px-4 py-3 text-left">Deposit Amount</th>
                  <th className="px-4 py-3 text-left">Withdraw Amount</th>
                  <th className="px-4 py-3 text-left">Payable Amount</th>
                  <th className="px-4 py-3 text-left">Tax Amount</th>
                  <th className="px-4 py-3 text-left">MDR Charge</th>
                  <th className="px-4 py-3 text-left">Profit Amount</th>
                  <th className="px-4 py-3 text-left">Pending Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                    <td className="px-4 py-3">{formatDate(tx.transaction_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {tx.card_number ? `**** **** **** ${getLastFourDigits(tx.card_number)}` : "—"}
                    </td>
                    <td className="px-4 py-3">{tx.card_name || "—"}</td>
                    <td className="px-4 py-3 text-green-400">
                      {formatCurrency(tx.deposit_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-red-400">
                      {formatCurrency(tx.withdraw_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-blue-400">
                      {formatCurrency(tx.payable_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-yellow-400">
                      {formatCurrency(tx.tax_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-orange-400">
                      {formatCurrency(tx.mdr_charge_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-purple-400">
                      {formatCurrency(tx.profit_amount || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={Number(tx.pending_amount) > 0 ? 'text-yellow-400' : 'text-green-400'}>
                        {formatCurrency(tx.pending_amount || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        tx.status === 'PAID' ? 'bg-green-600 text-white' : 
                        tx.status === 'Overpaid' ? 'bg-blue-600 text-white' : 
                        'bg-yellow-600 text-white'
                      }`}>
                        {tx.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              {selectedCard ? 'No transactions found for the selected card.' : 'No transactions found.'}
            </div>
          )}
        </div>

        {/* Summary */}
        {filteredTransactions.length > 0 && (
          <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Transaction Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <span className="text-gray-400 text-sm">Total Deposit:</span>
                <div className="text-green-400 font-medium text-lg">
                  {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (Number(tx.deposit_amount) || 0), 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Total Withdraw:</span>
                <div className="text-red-400 font-medium text-lg">
                  {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (Number(tx.withdraw_amount) || 0), 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Current Pending:</span>
                <div className={`font-medium text-lg ${
                  filteredTransactions.reduce((sum, tx) => sum + (Number(tx.pending_amount) || 0), 0) > 0 
                    ? 'text-yellow-400' 
                    : 'text-green-400'
                }`}>
                  {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (Number(tx.pending_amount) || 0), 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Total Tax:</span>
                <div className="text-yellow-400 font-medium text-lg">
                  {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (Number(tx.tax_amount) || 0), 0))}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Total Profit:</span>
                <div className="text-purple-400 font-medium text-lg">
                  {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (Number(tx.profit_amount) || 0), 0))}
                </div>
              </div>
            </div>
            
            {/* Balance Check */}
            {(() => {
              const totalDeposit = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.deposit_amount) || 0), 0);
              const totalWithdraw = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.withdraw_amount) || 0), 0);
              const currentPending = filteredTransactions.reduce((sum, tx) => sum + (Number(tx.pending_amount) || 0), 0);
              
              return (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    <span className="font-medium">Balance Check:</span> 
                    {currentPending === 0 ? (
                      <span className="text-green-400 ml-2">✓ Total Deposit ({formatCurrency(totalDeposit)}) = Total Withdraw ({formatCurrency(totalWithdraw)})</span>
                    ) : (
                      <span className="text-yellow-400 ml-2">⚠ Pending Amount: {formatCurrency(currentPending)}</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
