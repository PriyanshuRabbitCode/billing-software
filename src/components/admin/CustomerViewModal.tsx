"use client";

import { useEffect, useState } from "react";
import { User, CreditCard, FileText, Receipt, Building, MapPin, Phone, Mail, Calendar } from "lucide-react";
import PaymentModal from "./PaymentModal";

interface CustomerViewModalProps {
  open: boolean;
  onClose: () => void;
  customer: any | null;
}

export default function CustomerViewModal({
  open,
  onClose,
  customer,
}: CustomerViewModalProps) {
  const [customerData, setCustomerData] = useState<any>(null);
  const [taxDetails, setTaxDetails] = useState<any[]>([]);
  const [identityDocuments, setIdentityDocuments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cardPendingAmounts, setCardPendingAmounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  useEffect(() => {
    if (open && customer) {
      loadCustomerData();
    }
  }, [open, customer]);

  const loadCustomerData = async () => {
    if (!customer?.id) return;
    
    setLoading(true);
    try {
      // Use the new consolidated API with relations
      const customerRes = await fetch(`/api/customers?include=relations&id=${customer.id}`);
      
      if (!customerRes.ok) {
        throw new Error(`Failed to fetch customer data: ${customerRes.status}`);
      }
      
      const result = await customerRes.json();
      const customerWithRelations = result.data[0];
      
      if (!customerWithRelations) {
        throw new Error('Customer not found');
      }

      setCustomerData(customerWithRelations);
      setTaxDetails(customerWithRelations.tax_details || []);
      setIdentityDocuments(customerWithRelations.identity_documents || []);
      setAccounts(customerWithRelations.accounts || []);
      setCards(customerWithRelations.cards || []);
      setTransactions(customerWithRelations.transactions || []);
      setCardPendingAmounts(customerWithRelations.card_pending_amounts || []);
    } catch (error) {
      console.error('Error loading customer data:', error);
      // Fallback: use the original customer data
      setCustomerData(customer);
      setTaxDetails([]);
      setIdentityDocuments([]);
      setAccounts([]);
      setCards([]);
      setTransactions([]);
      setCardPendingAmounts([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handlePayClick = (cardData: any) => {
    setSelectedCard(cardData);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (cardNumber: string, newPendingAmount: number) => {
    // Update the card data optimistically
    setCardPendingAmounts(prev => 
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-900 text-gray-100 rounded-lg border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-500" />
            <h3 className="text-xl font-semibold">
              {loading ? "Loading..." : customerData?.full_name || "Customer Details"}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Customer Basic Information */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Full Name</label>
                    <p className="text-white font-medium">{customerData?.full_name || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Email</label>
                    <p className="text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      {customerData?.email_id || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Contact Number</label>
                    <p className="text-white flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      {customerData?.contact_no || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Created Date</label>
                    <p className="text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      {formatDate(customerData?.created_at)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-400">Billing Address</label>
                    <p className="text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      {customerData?.billing_address || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">City</label>
                    <p className="text-white">{customerData?.city || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">State</label>
                    <p className="text-white">{customerData?.state || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">PIN Code</label>
                    <p className="text-white">{customerData?.pin_code || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Tax Details */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-green-500" />
                  Tax Details
                </h4>
                {taxDetails.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left">PAN No</th>
                          <th className="px-4 py-2 text-left">Aadhaar No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxDetails.map((tax, index) => (
                          <tr key={index} className="border-t border-gray-700">
                            <td className="px-4 py-2">{tax.pan_no || "—"}</td>
                            <td className="px-4 py-2">{tax.aadhaar_no || "—"}</td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No tax details found</p>
                )}
              </div>

              {/* Identity Documents */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-yellow-500" />
                  Identity Documents
                </h4>
                {identityDocuments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left">Document Type</th>
                          <th className="px-4 py-2 text-left">Document Number</th>
                          <th className="px-4 py-2 text-left">Image</th>
                        </tr>
                      </thead>
                      <tbody>
                        {identityDocuments.map((doc, index) => (
                          <tr key={index} className="border-t border-gray-700">
                            <td className="px-4 py-2">{doc.document_type || "—"}</td>
                            <td className="px-4 py-2">{doc.document_number || "—"}</td>
                            <td className="px-4 py-2">
                              {doc.document_image ? (
                                <a 
                                  href={doc.document_image} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline"
                                >
                                  View Image
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No identity documents found</p>
                )}
              </div>

              {/* Account Information */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-purple-500" />
                  Account Information
                </h4>
                
                {/* Card Pending Amounts */}
                {cardPendingAmounts.length > 0 && (
                  <div className="mb-6">
                    <h5 className="text-md font-semibold mb-3 text-yellow-400">Card Pending Amounts</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-2 text-left">Card Number</th>
                            <th className="px-4 py-2 text-left">Card Name</th>
                            <th className="px-4 py-2 text-left">Received Amount</th>
                            <th className="px-4 py-2 text-left">Pending Amount</th>
                            <th className="px-4 py-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cardPendingAmounts.map((cardPending, index) => (
                            <tr key={index} className="border-t border-gray-700">
                              <td className="px-4 py-2 font-mono">
                                **** **** **** {getLastFourDigits(cardPending.cardNumber)}
                              </td>
                              <td className="px-4 py-2">{cardPending.cardName || "—"}</td>
                              <td className="px-4 py-2 font-semibold text-green-400">
                                {formatCurrency(cardPending.receivedAmount || 0)}
                              </td>
                              <td className="px-4 py-2 font-semibold">
                                <span className={Number(cardPending.pendingAmount) > 10000 ? 'text-red-400' : 'text-yellow-400'}>
                                  {formatCurrency(cardPending.pendingAmount || 0)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {cardPending.pendingAmount > 0 ? (
                                  <button
                                    onClick={() => handlePayClick(cardPending)}
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
                  </div>
                )}

                {/* Account Details */}
                {accounts.length > 0 ? (
                  <div>
                    <h5 className="text-md font-semibold mb-3 text-blue-400">Account Details</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-2 text-left">Credit Allowed</th>
                            <th className="px-4 py-2 text-left">Credit Limit</th>
                            <th className="px-4 py-2 text-left">Received</th>
                            <th className="px-4 py-2 text-left">Remark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((account, index) => (
                            <tr key={index} className="border-t border-gray-700">
                              <td className="px-4 py-2">
                                <span className={`px-2 py-1 rounded text-xs ${account.credit_allowed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                  {account.credit_allowed ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-4 py-2">{formatCurrency(account.credit_limit || 0)}</td>
                              <td className="px-4 py-2">{formatCurrency(account.received || 0)}</td>
                              <td className="px-4 py-2">{account.remark || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No account information found</p>
                )}
              </div>

              {/* Card Details */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-500" />
                  Card Details ({cards.length})
                </h4>
                {cards.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left">Bank Name</th>
                          <th className="px-4 py-2 text-left">Card Type</th>
                          <th className="px-4 py-2 text-left">Card Name</th>
                          <th className="px-4 py-2 text-left">Card Number</th>
                          <th className="px-4 py-2 text-left">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cards.map((card, index) => (
                          <tr key={index} className="border-t border-gray-700">
                            <td className="px-4 py-2">{card.bank_name || "—"}</td>
                            <td className="px-4 py-2">{card.card_type || "—"}</td>
                            <td className="px-4 py-2">{card.card_name || "—"}</td>
                            <td className="px-4 py-2 font-mono">{card.card_number || "—"}</td>
                            <td className="px-4 py-2">{formatDate(card.due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No cards found</p>
                )}
              </div>

              {/* Recent Transactions */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-cyan-500" />
                    Recent Transactions ({transactions.length})
                  </h4>
                  {transactions.length > 5 && (
                    <button
                      onClick={() => window.open(`/dashboard/customer-transactions/${customer?.id}`, '_blank')}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      View All
                    </button>
                  )}
                </div>
                {transactions.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-700 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">💡 Scroll horizontally to view all columns</div>
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-left">Card Number</th>
                          <th className="px-4 py-2 text-left">Card Name</th>
                          <th className="px-4 py-2 text-left">Deposit Amount</th>
                          <th className="px-4 py-2 text-left">Withdraw Amount</th>
                          <th className="px-4 py-2 text-left">Payable Amount</th>
                          <th className="px-4 py-2 text-left">Tax Amount</th>
                          <th className="px-4 py-2 text-left">MDR Charge</th>
                          <th className="px-4 py-2 text-left">Profit Amount</th>
                          <th className="px-4 py-2 text-left">Pending Amount</th>
                          <th className="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.slice(0, 5).map((tx, index) => (
                          <tr key={index} className="border-t border-gray-700 hover:bg-gray-700/30">
                            <td className="px-4 py-2">{formatDate(tx.transaction_date)}</td>
                            <td className="px-4 py-2 font-mono text-xs">
                              {tx.card_number ? `**** **** **** ${getLastFourDigits(tx.card_number)}` : "—"}
                            </td>
                            <td className="px-4 py-2">{tx.card_name || "—"}</td>
                            <td className="px-4 py-2 text-green-400">
                              {formatCurrency(tx.deposit_amount || 0)}
                            </td>
                            <td className="px-4 py-2 text-red-400">
                              {formatCurrency(tx.withdraw_amount || 0)}
                            </td>
                            <td className="px-4 py-2 text-blue-400">
                              {formatCurrency(tx.payable_amount || 0)}
                            </td>
                            <td className="px-4 py-2 text-yellow-400">
                              {formatCurrency(tx.tax_amount || 0)}
                            </td>
                            <td className="px-4 py-2 text-orange-400">
                              {formatCurrency(tx.mdr_charge_amount || 0)}
                            </td>
                            <td className="px-4 py-2 text-purple-400">
                              {formatCurrency(tx.profit_amount || 0)}
                            </td>
                            <td className="px-4 py-2">
                              <span className={Number(tx.pending_amount) > 0 ? 'text-yellow-400' : 'text-green-400'}>
                                {formatCurrency(tx.pending_amount || 0)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
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
                    {transactions.length > 5 && (
                      <p className="text-gray-400 text-center py-2 text-sm">
                        Showing 5 of {transactions.length} transactions
                      </p>
                    )}
                    

                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No transactions found</p>
                )}
              </div>
            </div>
          )}
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
    </div>
  );
}
