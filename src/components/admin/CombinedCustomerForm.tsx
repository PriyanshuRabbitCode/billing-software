"use client";

import { useCallback, useEffect, useState } from "react";
import { schemas } from "@/lib/tableSchemas";
import { CrudField } from "./CrudFormModal";
import { useToastHelpers } from "@/components/ui/Toast";

interface CombinedCustomerFormProps {
  open: boolean;
  onClose: () => void;
  initialCustomer?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<any>;
  title: string;
}

export default function CombinedCustomerForm({
  open,
  onClose,
  initialCustomer,
  onSubmit,
  title,
}: CombinedCustomerFormProps) {
  // Form values for each section
  const [customerValues, setCustomerValues] = useState<Record<string, any>>({});
  const [taxValues, setTaxValues] = useState<Record<string, any>>({});
  const [docValues, setDocValues] = useState<Record<string, any>>({});
  const [accountValues, setAccountValues] = useState<Record<string, any>>({});
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [panAutoFilled, setPanAutoFilled] = useState(false);
  const [aadhaarAutoFilled, setAadhaarAutoFilled] = useState(false);
  
  // Options for dropdowns (relations)
  const [options, setOptions] = useState<Record<string, Array<{ value: any; label: string }>>>({});
  
  // Schemas for each form section
  const customerSchema = schemas.customers;
  const taxSchema = schemas.customer_tax_details;
  const docSchema = schemas.identity_documents;
  const accountSchema = schemas.accounts;

  // Initialize form values when the modal opens or when editing an existing customer
  useEffect(() => {
    // Initialize customer values
    const cv: Record<string, any> = {};
    customerSchema.fields.forEach((f) => {
      const initialValue = initialCustomer?.[f.name];
      if (initialValue !== undefined && initialValue !== null) {
        cv[f.name] = initialValue;
      } else {
        cv[f.name] = f.type === "boolean" ? false : "";
      }
    });
    setCustomerValues(cv);

    // Initialize tax values with empty fields
    const tv: Record<string, any> = {};
    taxSchema.fields.forEach((f) => {
      tv[f.name] = f.type === "boolean" ? false : "";
    });
    setTaxValues(tv);

    // Initialize document values with empty fields
    const dv: Record<string, any> = {};
    docSchema.fields.forEach((f) => {
      dv[f.name] = f.type === "boolean" ? false : "";
    });
    setDocValues(dv);
    
    // Initialize account values with empty fields
    const av: Record<string, any> = {};
    accountSchema.fields.forEach((f) => {
      // Skip received and pending_amount fields as requested
      if (f.name !== "received" && f.name !== "pending_amount") {
        av[f.name] = f.type === "boolean" ? false : "";
      }
    });
    setAccountValues(av);

    // If editing, fetch related tax details, documents, and account info
    if (initialCustomer?.id) {
      fetchRelatedData(initialCustomer.id);
    }
  }, [initialCustomer, open]);

  // Debug helpers to gate logs in production
  const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';
  const debugLog = (...args: any[]) => { if (DEBUG) console.log(...args); };
  const debugError = (...args: any[]) => { if (DEBUG) console.error(...args); };
  const { success, error: showError } = useToastHelpers();

  // Fetch tax details, documents, and account info for an existing customer
  const fetchRelatedData = async (customerId: string) => {
    try {
      debugLog('Fetching related data for customer ID:', customerId);
      
      // Fetch tax details
      const taxRes = await fetch(`/api/${taxSchema.table}`);
      const taxResult = await taxRes.json();
      const taxData = taxResult.data || taxResult; // Handle both new API format and old format
      const customerTax = taxData.find((item: any) => item.customer_id === customerId);
      
      debugLog('Found tax details:', customerTax);
      
      if (customerTax) {
        setTaxValues({
          id: customerTax.id, // Store the ID for PATCH operations
          customer_id: customerId,
          pan_no: customerTax.pan_no || "",
          aadhaar_no: customerTax.aadhaar_no || "",
          // gst_type: customerTax.gst_type || "", // Removed as requested
        });
      } else {
        // Initialize empty tax values if no existing data
        setTaxValues({
          customer_id: customerId,
          pan_no: "",
          aadhaar_no: "",
        });
      }

      // Fetch documents
      const docRes = await fetch(`/api/${docSchema.table}`);
      const docResult = await docRes.json();
      const docData = docResult.data || docResult; // Handle both new API format and old format
      const customerDoc = docData.find((item: any) => item.customer_id === customerId);
      
      debugLog('Found document details:', customerDoc);
      
      if (customerDoc) {
        setDocValues({
          id: customerDoc.id, // Store the ID for PATCH operations
          customer_id: customerId,
          document_type: customerDoc.document_type || "",
          document_number: customerDoc.document_number || "",
          document_image: customerDoc.document_image || "",
        });
      } else {
        // Initialize empty document values if no existing data
        setDocValues({
          customer_id: customerId,
          document_type: "",
          document_number: "",
          document_image: "",
        });
      }
      
      // Fetch account info
      const accountRes = await fetch(`/api/${accountSchema.table}`);
      const accountResult = await accountRes.json();
      const accountData = accountResult.data || accountResult; // Handle both new API format and old format
      const customerAccount = accountData.find((item: any) => item.customer_id === customerId);
      
      debugLog('Found account details:', customerAccount);
      
      if (customerAccount) {
        setAccountValues({
          id: customerAccount.id, // Store the ID for PATCH operations
          customer_id: customerId,
          credit_allowed: customerAccount.credit_allowed || false,
          credit_limit: customerAccount.credit_limit || "",
          price_category: customerAccount.price_category || "",
          remark: customerAccount.remark || "",
          // Exclude received and pending_amount as requested
        });
      } else {
        // Initialize empty account values if no existing data
        setAccountValues({
          customer_id: customerId,
          credit_allowed: false,
          credit_limit: "",
          price_category: "",
          remark: "",
        });
      }
    } catch (err) {
      debugError('Error fetching related data:', err);
    }
  };

  // Function to fetch PAN number from customer tax details
  const fetchPANNumber = async (customerId: string) => {
    try {
      const taxRes = await fetch(`/api/${taxSchema.table}`);
      const taxResult = await taxRes.json();
      const taxData = taxResult.data || taxResult; // Handle both new API format and old format
      const customerTax = taxData.find((item: any) => item.customer_id === customerId);
      return customerTax?.pan_no || "";
    } catch (err) {
      debugError('Error fetching PAN number:', err);
      return "";
    }
  };

  // Function to fetch Aadhaar number from customer tax details
  const fetchAadhaarNumber = async (customerId: string) => {
    try {
      const taxRes = await fetch(`/api/${taxSchema.table}`);
      const taxData = await taxRes.json();
      const customerTax = taxData.find((item: any) => item.customer_id === customerId);
      return customerTax?.aadhaar_no || "";
    } catch (err) {
      debugError('Error fetching Aadhaar number:', err);
      return "";
    }
  };

  // Handle document type change
  const handleDocumentTypeChange = async (documentType: string) => {
    // Clear previous document number and auto-fill states when type changes
    const newDocValues: Record<string, any> = { 
      ...docValues, 
      document_type: documentType,
      document_number: "" // Clear the document number when type changes
    };
    
    setPanAutoFilled(false);
    setAadhaarAutoFilled(false);
    
    // If PAN Card is selected, try to get PAN number from multiple sources
    if (documentType === "PAN Card") {
      let panNumber = "";
      let source = "";
      
      // First, check if PAN is already entered in tax details form
      if (taxValues.pan_no) {
        panNumber = taxValues.pan_no;
        source = "tax details form";
      }
      // If not in form, and we have a customer ID, fetch from database
      else if (initialCustomer?.id) {
        panNumber = await fetchPANNumber(initialCustomer.id);
        source = "database";
      }
      
      if (panNumber) {
        newDocValues.document_number = panNumber;
        setPanAutoFilled(true);
        debugLog(`Auto-filled PAN number from ${source}: ${panNumber}`);
      }
    }
    
    // If Aadhaar Card is selected, try to get Aadhaar number from multiple sources
    if (documentType === "Aadhaar Card") {
      let aadhaarNumber = "";
      let source = "";
      
      // First, check if Aadhaar is already entered in tax details form
      if (taxValues.aadhaar_no) {
        aadhaarNumber = taxValues.aadhaar_no;
        source = "tax details form";
      }
      // If not in form, and we have a customer ID, fetch from database
      else if (initialCustomer?.id) {
        aadhaarNumber = await fetchAadhaarNumber(initialCustomer.id);
        source = "database";
      }
      
      if (aadhaarNumber) {
        newDocValues.document_number = aadhaarNumber;
        setAadhaarAutoFilled(true);
        debugLog(`Auto-filled Aadhaar number from ${source}: ${aadhaarNumber}`);
      }
    }
    
    setDocValues(newDocValues);
  };

  // Load relation options (for dropdowns)
  useEffect(() => {
    let active = true;
    async function loadRelations() {
      const allFields = [...customerSchema.fields, ...taxSchema.fields, ...docSchema.fields];
      const relationFields = allFields.filter((f) => f.relation);
      
      if (relationFields.length === 0) return;
      
      const loaded: Record<string, Array<{ value: any; label: string }>> = {};
      for (const f of relationFields) {
        try {
          const res = await fetch(`/api/customers`);
          const result = await res.json();
          const list = result.data || result;
          loaded[f.name] = list.map((r: any) => ({ 
            value: r.id, 
            label: r.full_name 
          }));
        } catch (e) {
          loaded[f.name] = [];
        }
      }
      
      if (active) setOptions(loaded);
    }
    
    loadRelations();
    return () => {
      active = false;
    };
  }, []);

  // Validate all form sections
  const validate = async (): Promise<boolean> => {
    const e: Record<string, string> = {};
    
    // Validate customer fields
    for (const f of customerSchema.fields) {
      const v = customerValues[f.name];
      if (f.required && (v === "" || v === undefined || v === null)) {
        e[f.name] = `${f.label} is required`;
      }
      
      // Check for unique email
      if (f.name === 'email_id' && v) {
        try {
          const response = await fetch('/api/check-customer-unique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              field: 'email_id',
              value: v,
              customerId: initialCustomer?.id
            })
          });

          const data = await response.json();
          if (data.formatError) {
            e.email_id = data.formatError;
          } else if (data.exists) {
            e.email_id = "This email is already registered with another customer";
          }
        } catch (error) {
          debugError('Error checking email uniqueness:', error);
        }
      }
      
      // Check for unique contact number
      if (f.name === 'contact_no' && v) {
        try {
          const response = await fetch('/api/check-customer-unique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              field: 'contact_no',
              value: v,
              customerId: initialCustomer?.id
            })
          });

          const data = await response.json();
          if (data.formatError) {
            e.contact_no = data.formatError;
          } else if (data.exists) {
            e.contact_no = "This contact number is already registered with another customer";
          }
        } catch (error) {
          debugError('Error checking contact number uniqueness:', error);
        }
      }
    }
    
    // Only validate tax fields if any of them are filled
    const hasTaxData = taxValues.pan_no || taxValues.aadhaar_no;
    if (hasTaxData) {
      for (const f of taxSchema.fields) {
        // Skip customer_id as it will be set automatically
        if (f.name === "customer_id") continue;
        
        const v = taxValues[f.name];
        if (f.required && (v === "" || v === undefined || v === null)) {
          e[`tax_${f.name}`] = `${f.label} is required`;
        }
        
        // Check for unique PAN number
        if (v && f.name === 'pan_no') {
          try {
            const response = await fetch('/api/check-customer-unique', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                field: f.name,
                value: v,
                customerId: initialCustomer?.id
              })
            });

            const data = await response.json();
            if (data.formatError) {
              e[`tax_${f.name}`] = data.formatError;
            } else if (data.exists) {
              e[`tax_${f.name}`] = `This PAN number is already registered with another customer`;
            }
          } catch (error) {
            debugError(`Error checking ${f.name} uniqueness:`, error);
          }
        }
        
        // Check for unique Aadhaar number
        if (v && f.name === 'aadhaar_no') {
          try {
            const response = await fetch('/api/check-customer-unique', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                field: f.name,
                value: v,
                customerId: initialCustomer?.id
              })
            });

            const data = await response.json();
            if (data.formatError) {
              e[`tax_${f.name}`] = data.formatError;
            } else if (data.exists) {
              e[`tax_${f.name}`] = `This Aadhaar number is already registered with another customer`;
            }
          } catch (error) {
            debugError(`Error checking ${f.name} uniqueness:`, error);
          }
        }
      }
      

    }
    
    // Only validate document fields if any of them are filled
    const hasDocData = docValues.document_type || docValues.document_number || docValues.document_image;
    if (hasDocData) {
      for (const f of docSchema.fields) {
        // Skip customer_id as it will be set automatically
        if (f.name === "customer_id") continue;
        
        const v = docValues[f.name];
        if (f.required && (v === "" || v === undefined || v === null)) {
          e[`doc_${f.name}`] = `${f.label} is required`;
        }
      }
      
      // Validate document number based on type
      if (docValues.document_type && docValues.document_number) {
        const docType = docValues.document_type;
        const docNumber = docValues.document_number;
        
        if (docType === "Aadhaar Card" && !/^\d{12}$/.test(docNumber)) {
          e.doc_document_number = "Aadhaar number must be 12 digits";
        } else if (docType === "PAN Card" && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(docNumber)) {
          e.doc_document_number = "Invalid PAN number format (e.g., ABCDE1234F)";
        } else if (docType === "Voter ID" && !/^[A-Z]{3}\d{7}$/.test(docNumber)) {
          e.doc_document_number = "Invalid Voter ID format (e.g., ABC1234567)";
        }
      }
    }
    
    // Only validate account fields if any of them are filled
    const hasAccountData = accountValues.credit_limit || 
                          accountValues.remark ||
                          accountValues.credit_allowed === true;
    if (hasAccountData) {
      for (const f of accountSchema.fields) {
        // Skip customer_id, received, pending_amount, and price_category
        if (f.name === "customer_id" || 
            f.name === "received" || 
            f.name === "pending_amount" || 
            f.name === "price_category") continue;
        
        const v = accountValues[f.name];
        
        // Handle required fields
        if (f.required && (v === "" || v === undefined || v === null)) {
          e[`account_${f.name}`] = `${f.label} is required`;
        }
        
        // Special handling for credit limit
        if (f.name === "credit_limit") {
          if (accountValues.credit_allowed === true) {
            // If credit is allowed, credit limit is required
            if (v === "" || v === undefined || v === null) {
              e.account_credit_limit = "Credit Limit is required when Credit Allowed is Yes";
            } else if (isNaN(Number(v))) {
              e.account_credit_limit = "Credit Limit must be a number";
            } else if (Number(v) <= 0) {
              e.account_credit_limit = "Credit Limit must be greater than 0";
            }
          } else {
            // If credit is not allowed, credit limit should be null
            if (v !== "" && v !== undefined && v !== null) {
              e.account_credit_limit = "Credit Limit should be empty when Credit Allowed is No";
            }
          }
        }
        
        // Validate opening balance

      }
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Validate PAN number format
  const validatePAN = (pan: string): boolean => {
    // PAN format: AAAAA1234A (5 letters + 4 numbers + 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  // Validate Aadhaar number format
  const validateAadhaar = (aadhaar: string): boolean => {
    // Remove all spaces and non-digit characters, then check if it's 12 digits
    const cleanAadhaar = aadhaar.replace(/\s/g, '').replace(/\D/g, '');
    const aadhaarRegex = /^\d{12}$/;
    return aadhaarRegex.test(cleanAadhaar);
  };

  // Handle file upload for identity documents
  const handleFileUpload = async (file: File, customerId: string, docType: string) => {
    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('customerId', customerId);
    formData.append('docType', docType);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const raw = await response.text();
    if (!response.ok) {
      let errorMessage = 'Upload failed';
      try {
        const data = JSON.parse(raw);
        errorMessage = data.error || data.message || errorMessage;
      } catch {
        if (raw.includes('<html') || raw.includes('<!DOCTYPE')) {
          errorMessage = 'Server error occurred. Please check server logs.';
        } else if (raw) {
          errorMessage = raw.substring(0, 200) + '...';
        }
      }
      throw new Error(errorMessage);
    }

    try {
      const data = JSON.parse(raw);
      return data.path;
    } catch {
      throw new Error('Invalid server response');
    }
  };

  // Helper functions for input types
  const getInputType = (field: CrudField) => {
    if (field.type === "number") return "number";
    if (field.type === "datetime") return "datetime-local";
    if (field.name === "email_id") return "email";
    if (field.name === "contact_no") return "tel";
    return "text";
  };

  const getInputMode = (field: CrudField) => {
    if (field.type === "number") return "numeric";
    if (field.name === "contact_no" || field.name === "pin_code") return "numeric";
    if (field.name === "email_id") return "email";
    return "text";
  };

  // Submit all forms
  const submit = async () => {
    debugLog('Starting form submission...');
    debugLog('Customer values:', customerValues);
    debugLog('Tax values:', taxValues);
    debugLog('Document values:', docValues);
    debugLog('Account values:', accountValues);
    
    const isValid = await validate();
    if (!isValid) {
      debugLog('Validation failed:', errors);
      return;
    }
    
    setLoading(true);
    
    try {
      debugLog('Initial customer data:', initialCustomer);
      
      // Make sure we have the ID in the customer values for editing
      if (initialCustomer?.id) {
        customerValues.id = initialCustomer.id;
      }
      
      // Set created_at timestamp if it's a new customer
      if (!initialCustomer) {
        customerValues.created_at = new Date().toISOString();
      }
      
      debugLog('Submitting customer values:', customerValues);
      
      // First save customer data
      const customerResult = await onSubmit(customerValues);
      debugLog('Customer save result:', customerResult);
      debugLog('Initial customer ID:', initialCustomer?.id);
      debugLog('Customer result ID:', customerResult?.id);
      debugLog('Customer values ID:', customerValues.id);
      
      const customerId: string = String(initialCustomer?.id || customerResult?.id || customerValues.id || '');
      debugLog('Final customer ID:', customerId);
      
      if (!customerId) {
        debugError('No customer ID found after save');
        debugError('Initial customer:', initialCustomer);
        debugError('Customer result:', customerResult);
        debugError('Customer values:', customerValues);
        throw new Error("Failed to get customer ID after save");
      }
      
      // Check if tax details should be saved
      const hasTaxData = taxValues.pan_no || taxValues.aadhaar_no;
      if (hasTaxData) {
        // Clean Aadhaar number by removing spaces and non-digits before saving
        const cleanTaxValues = { ...taxValues };
        if (cleanTaxValues.aadhaar_no) {
          cleanTaxValues.aadhaar_no = cleanTaxValues.aadhaar_no.replace(/\s/g, '').replace(/\D/g, '');
        }
        
        // Set customer ID for tax details
        const taxDataToSave = {
          ...cleanTaxValues,
          customer_id: customerId
        };
        
        debugLog('Tax data to save:', taxDataToSave);
        
        // If we're editing an existing customer, check if tax details already exist
        let existingTaxId = taxValues.id;
        
        if (!existingTaxId && initialCustomer?.id) {
          try {
            // Check for existing tax details
            const taxRes = await fetch(`/api/${taxSchema.table}`);
            const taxResult = await taxRes.json();
            const allTaxDetails = taxResult.data || taxResult; // Handle both new API format and old format
            const existing = allTaxDetails.find((detail: any) => detail.customer_id === customerId);
            
            if (existing) {
              existingTaxId = existing.id;
              debugLog('Found existing tax details:', existing);
            }
          } catch (err) {
            debugError('Error checking existing tax details:', err);
          }
        }
        
        // Save tax details - use PATCH if we have an ID, otherwise POST
        if (existingTaxId) {
          debugLog(`Updating tax details with ID: ${existingTaxId}`);
          debugLog('Tax data being sent:', taxDataToSave);
          
          const res = await fetch(`/api/${taxSchema.table}/${existingTaxId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taxDataToSave)
          });
          
          debugLog('Tax update response status:', res.status);
          const responseText = await res.text();
          if (!res.ok) {
            let errorMessage = `Failed to update tax details: ${res.status} ${res.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              debugError('Error updating tax details:', errorData);
              errorMessage = errorData.error || errorMessage;
            } catch {
              if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else if (responseText) {
                errorMessage = responseText.substring(0, 200) + '...';
              }
            }
            throw new Error(errorMessage);
          }
          try {
            const result = JSON.parse(responseText);
            debugLog('Tax update result:', result);
          } catch {
            debugLog('Tax update result (non-JSON):', responseText?.substring(0, 200));
          }
        } else {
          debugLog('Creating new tax details');
          debugLog('Tax data being sent:', taxDataToSave);
          
          const res = await fetch(`/api/${taxSchema.table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taxDataToSave)
          });
          
          debugLog('Tax create response status:', res.status);
          const responseText = await res.text();
          if (!res.ok) {
            let errorMessage = `Failed to create tax details: ${res.status} ${res.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              debugError('Error creating tax details:', errorData);
              errorMessage = errorData.error || errorMessage;
            } catch {
              if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else if (responseText) {
                errorMessage = responseText.substring(0, 200) + '...';
              }
            }
            throw new Error(errorMessage);
          }
          try {
            const result = JSON.parse(responseText);
            debugLog('Tax create result:', result);
          } catch {
            debugLog('Tax create result (non-JSON):', responseText?.substring(0, 200));
          }
        }
      }
      
      // Check if document details should be saved
      const hasDocData = docValues.document_type || docValues.document_number || docValues.document_image instanceof File;
      if (hasDocData) {
        // Handle file upload if there's a file
        let imageUrl = docValues.document_image;
        if (docValues.document_image instanceof File) {
          imageUrl = await handleFileUpload(
            docValues.document_image,
            customerId,
            docValues.document_type
          );
        }
        
        // Set customer ID and image URL for document
        const docDataToSave = {
          ...docValues,
          customer_id: customerId,
          document_image: imageUrl
        };
        
        debugLog('Document data to save:', docDataToSave);
        
        // If we're editing an existing customer, check if document details already exist
        let existingDocId = docValues.id;
        
        if (!existingDocId && initialCustomer?.id) {
          try {
            // Check for existing document details
            const docRes = await fetch(`/api/${docSchema.table}`);
            const docResult = await docRes.json();
            const allDocDetails = docResult.data || docResult; // Handle both new API format and old format
            const existing = allDocDetails.find((detail: any) => 
              detail.customer_id === customerId && detail.document_type === docValues.document_type
            );
            
            if (existing) {
              existingDocId = existing.id;
              debugLog('Found existing document details:', existing);
            }
          } catch (err) {
            debugError('Error checking existing document details:', err);
          }
        }
        
        // Save document details - use PATCH if we have an ID, otherwise POST
        if (existingDocId) {
          debugLog(`Updating document details with ID: ${existingDocId}`);
          debugLog('Document data being sent:', docDataToSave);
          
          const res = await fetch(`/api/${docSchema.table}/${existingDocId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docDataToSave)
          });
          
          debugLog('Document update response status:', res.status);
          const responseText = await res.text();
          if (!res.ok) {
            let errorMessage = `Failed to update document details: ${res.status} ${res.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              debugError('Error updating document details:', errorData);
              errorMessage = errorData.error || errorMessage;
            } catch {
              if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else if (responseText) {
                errorMessage = responseText.substring(0, 200) + '...';
              }
            }
            throw new Error(errorMessage);
          }
          try {
            const result = JSON.parse(responseText);
            debugLog('Document update result:', result);
          } catch {
            debugLog('Document update result (non-JSON):', responseText?.substring(0, 200));
          }
        } else {
          debugLog('Creating new document details');
          debugLog('Document data being sent:', docDataToSave);
          
          const res = await fetch(`/api/${docSchema.table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docDataToSave)
          });
          
          debugLog('Document create response status:', res.status);
          const responseText = await res.text();
          if (!res.ok) {
            let errorMessage = `Failed to create document details: ${res.status} ${res.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              debugError('Error creating document details:', errorData);
              errorMessage = errorData.error || errorMessage;
            } catch {
              if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else if (responseText) {
                errorMessage = responseText.substring(0, 200) + '...';
              }
            }
            throw new Error(errorMessage);
          }
          try {
            const result = JSON.parse(responseText);
            debugLog('Document create result:', result);
          } catch {
            debugLog('Document create result (non-JSON):', responseText?.substring(0, 200));
          }
        }
      }
      
      // Check if account details should be saved
      const hasAccountData = accountValues.credit_limit || 
                            accountValues.price_category || 
                            accountValues.remark ||
                            accountValues.credit_allowed === true;
      if (hasAccountData) {
        // Set customer ID for account
        const accountDataToSave: Record<string, any> = {
          ...accountValues,
          customer_id: customerId,
          // Initialize received and pending_amount to 0 for new accounts
          received: 0,
          pending_amount: 0
        };
        
        // Handle credit limit based on credit_allowed setting
        if (accountValues.credit_allowed !== true) {
          // If credit is not allowed, set credit_limit to null
          accountDataToSave.credit_limit = null;
        }
        
        debugLog('Account data to save:', accountDataToSave);
        
        // If we're editing an existing customer, check if account already exists
        let existingAccountId = accountValues.id;
        
        if (!existingAccountId && initialCustomer?.id) {
          try {
            // Check for existing account
            const accountRes = await fetch(`/api/${accountSchema.table}`);
            const accountResult = await accountRes.json();
            const allAccounts = accountResult.data || accountResult; // Handle both new API format and old format
            const existing = allAccounts.find((account: any) => account.customer_id === customerId);
            
            if (existing) {
              existingAccountId = existing.id;
              debugLog('Found existing account:', existing);
            }
          } catch (err) {
            debugError('Error checking existing account:', err);
          }
        }
        
        // Save account details - use PATCH if we have an ID, otherwise POST
        if (existingAccountId) {
          debugLog(`Updating account with ID: ${existingAccountId}`);
          debugLog('Account data being sent:', accountDataToSave);
          
          const res = await fetch(`/api/${accountSchema.table}/${existingAccountId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accountDataToSave)
          });
          
          debugLog('Account update response status:', res.status);
          const responseText = await res.text();
          if (!res.ok) {
            let errorMessage = `Failed to update account: ${res.status} ${res.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              debugError('Error updating account:', errorData);
              errorMessage = errorData.error || errorMessage;
            } catch {
              if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else if (responseText) {
                errorMessage = responseText.substring(0, 200) + '...';
              }
            }
            throw new Error(errorMessage);
          }
          try {
            const result = JSON.parse(responseText);
            debugLog('Account update result:', result);
          } catch {
            debugLog('Account update result (non-JSON):', responseText?.substring(0, 200));
          }
        } else {
          debugLog('Creating new account');
          debugLog('Account data being sent:', accountDataToSave);
          
          const res = await fetch(`/api/${accountSchema.table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accountDataToSave)
          });
          
          debugLog('Account create response status:', res.status);
          const responseText = await res.text();
          if (!res.ok) {
            let errorMessage = `Failed to create account: ${res.status} ${res.statusText}`;
            try {
              const errorData = JSON.parse(responseText);
              debugError('Error creating account:', errorData);
              errorMessage = errorData.error || errorMessage;
            } catch {
              if (responseText.includes('<html') || responseText.includes('<!DOCTYPE')) {
                errorMessage = 'Server error occurred. Please check server logs.';
              } else if (responseText) {
                errorMessage = responseText.substring(0, 200) + '...';
              }
            }
            throw new Error(errorMessage);
          }
          try {
            const result = JSON.parse(responseText);
            debugLog('Account create result:', result);
          } catch {
            debugLog('Account create result (non-JSON):', responseText?.substring(0, 200));
          }
        }
      }
      
      // Reset form and close modal
      setCustomerValues({});
      setTaxValues({});
      setDocValues({});
      setAccountValues({});
      setPanAutoFilled(false);
      setAadhaarAutoFilled(false);
      
      // Show success message
      success('Customer data saved successfully!');
      onClose();
    } catch (error) {
      debugError('Submit error:', error);
      // Show more detailed error message
      if (error instanceof Error) {
        debugError('Error details:', error.message);
        debugError('Error stack:', error.stack);
        showError('Error saving customer data.', error.message);
      } else {
        debugError('Unknown error type:', typeof error);
        showError('Error saving customer data.');
      }
      // Don't close modal on error so user can fix the issue
    } finally {
      setLoading(false);
    }
  };

  // Render form field based on its type
  const renderField = (
    field: CrudField, 
    values: Record<string, any>,
    setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    errorPrefix: string = ""
  ) => {
    return (
      <div key={field.name} className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">
          {field.label}{field.required ? " *" : ""}
        </label>
        
        {field.type === "textarea" && (
          <textarea
            value={values[field.name] ?? ""}
            onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
            placeholder={field.placeholder}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 h-24"
          />
        )}
        
        {(field.type === "text" || field.type === "number" || field.type === "datetime") && (
          <>
            {field.name === "document_image" ? (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setValues({ ...values, [field.name]: file });
                  }
                }}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              />
            ) : (
              <input
                type={getInputType(field)}
                value={values[field.name] ?? ""}
                onChange={(e) => {
                  const newValues = { ...values, [field.name]: e.target.value };
                  setValues(newValues);
                  
                  // Auto-fill document number when PAN is entered in tax details
                  if (field.name === "pan_no" && e.target.value && docValues.document_type === "PAN Card") {
                    setDocValues({ ...docValues, document_number: e.target.value });
                    setPanAutoFilled(true);
                    setAadhaarAutoFilled(false);
                  }
                  
                  // Auto-fill document number when Aadhaar is entered in tax details
                  if (field.name === "aadhaar_no" && e.target.value && docValues.document_type === "Aadhaar Card") {
                    setDocValues({ ...docValues, document_number: e.target.value });
                    setAadhaarAutoFilled(true);
                    setPanAutoFilled(false);
                  }
                  
                  // Clean Aadhaar number by removing spaces and non-digits
                  if (field.name === "aadhaar_no") {
                    const cleanValue = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                    newValues[field.name] = cleanValue;
                  }
                }}
                placeholder={field.placeholder}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
                inputMode={getInputMode(field)}
                autoComplete="off"
              />
            )}
          </>
        )}
        
        {field.type === "boolean" && (
          <select
            value={String(values[field.name] ?? false)}
            onChange={(e) => {
              const newValue = e.target.value === "true";
              const newValues = { ...values, [field.name]: newValue };
              
              // Clear credit limit when credit allowed is set to false
              if (field.name === "credit_allowed" && !newValue) {
                newValues.credit_limit = "";
              }
              
              setValues(newValues);
            }}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )}
        
        {(field.type === "enum" || field.type === "select") && (
          <select
            value={values[field.name] ?? ""}
            onChange={(e) => {
              // Use custom handler for document type changes
              if (field.name === "document_type") {
                handleDocumentTypeChange(e.target.value);
              } else {
                setValues({ ...values, [field.name]: e.target.value });
              }
            }}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
          >
            <option value="">Select...</option>
            {field.enumValues?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {field.relation && options[field.name]?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        
        {errors[`${errorPrefix}${field.name}`] && (
          <span className="text-xs text-red-400">{errors[`${errorPrefix}${field.name}`]}</span>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-gray-900 text-gray-100 rounded-lg border border-gray-800 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={() => {
            setPanAutoFilled(false);
            setAadhaarAutoFilled(false);
            onClose();
          }} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Customer Information Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Customer Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customerSchema.fields.map((field) => 
              field.name !== "created_at" && renderField(field, customerValues, setCustomerValues)
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-700 my-6"></div>

        {/* Tax Details Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Customer Tax Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxSchema.fields.map((field) => 
              field.name !== "customer_id" && renderField(field, taxValues, setTaxValues, "tax_")
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-700 my-6"></div>

        {/* Identity Documents Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Identity Documents</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docSchema.fields.map((field) => 
              field.name !== "customer_id" && renderField(field, docValues, setDocValues, "doc_")
            )}
          </div>
          {panAutoFilled && docValues.document_type === "PAN Card" && (
            <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
              ℹ️ PAN number auto-filled from tax details
            </div>
          )}
          {aadhaarAutoFilled && docValues.document_type === "Aadhaar Card" && (
            <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
              ℹ️ Aadhaar number auto-filled from tax details
            </div>
          )}
        </div>
        
        {/* Separator */}
        <div className="border-t border-gray-700 my-6"></div>
        
        {/* Accounts Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium mb-3">Account Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accountSchema.fields.map((field) => {
                      // Skip customer_id, received, pending_amount, and price_category fields
        if (field.name === "customer_id" || 
            field.name === "received" || 
            field.name === "pending_amount" || 
            field.name === "price_category") {
                return null;
              }

              // For credit_limit, only render if credit_allowed is true
              if (field.name === "credit_limit" && !accountValues.credit_allowed) {
                return null;
              }

              return renderField(field, accountValues, setAccountValues, "account_");
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button 
            onClick={() => {
              setPanAutoFilled(false);
              setAadhaarAutoFilled(false);
              onClose();
            }} 
            className="px-4 py-2 rounded bg-gray-800 border border-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
