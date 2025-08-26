"use client";

import { useEffect, useState, useRef } from "react";
import { useCustomers } from "@/lib/hooks/useCustomers";

interface Customer {
  id: number;
  full_name: string;
  email_id: string;
  contact_no: string;
}

interface SearchableCustomerInputProps {
  onChange: (customerId: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  initialCustomerName?: string;
}

export default function SearchableCustomerInput({
  onChange,
  placeholder = "Search customers...",
  className = "",
  error,
  initialCustomerName
}: SearchableCustomerInputProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Use the new customers hook
  const { customers, loading, error: fetchError } = useCustomers();

  // Initialize search term with initial customer name if provided
  useEffect(() => {
    if (initialCustomerName && !searchTerm) {
      setSearchTerm(initialCustomerName);
    }
  }, [initialCustomerName, searchTerm]);

  // Filter customers based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = customers.filter(customer =>
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_no.includes(searchTerm)
    ).slice(0, 10); // Limit to 10 suggestions

    setFilteredCustomers(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [searchTerm, customers]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // If input is cleared, clear the selection
    if (!newValue.trim()) {
      onChange("");
    }
  };

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setSearchTerm(customer.full_name);
    setShowSuggestions(false);
    onChange(customer.id.toString());
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filteredCustomers.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={`bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full ${className} ${
          error ? 'border-red-500' : ''
        }`}
      />
      
      {error && (
        <span className="text-xs text-red-400 mt-1 block">{error}</span>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {loading ? (
            <div className="px-3 py-2 text-gray-400 text-sm">Loading...</div>
          ) : fetchError ? (
            <div className="px-3 py-2 text-red-400 text-sm">Error loading customers</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="px-3 py-2 text-gray-400 text-sm">No customers found</div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className="px-3 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
              >
                <div className="font-medium text-gray-100">{customer.full_name}</div>
                <div className="text-sm text-gray-400">
                  {customer.email_id} • {customer.contact_no}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
