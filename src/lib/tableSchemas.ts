import { CrudField } from "@/components/admin/CrudFormModal";

export interface TableSchema {
  table: string;
  title: string;
  fields: CrudField[];
  listColumns: Array<{ 
    key: string; 
    label: string; 
    sortable?: boolean;
    render?: (row: any) => React.ReactNode;
  }>;
}

export const schemas: Record<string, TableSchema> = {
  customers: {
    table: "customers",
    title: "Customers",
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "billing_address", label: "Billing Address", type: "textarea", required: true },
      { name: "city", label: "City", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "pin_code", label: "PIN Code", type: "text", required: true },
      // { name: "country", label: "Country", type: "text", required: true }, // Removed as requested
      { name: "email_id", label: "Email", type: "text", required: true },
      { name: "contact_no", label: "Contact No", type: "text", required: true },
      { name: "created_at", label: "Created At", type: "datetime" },
    ],
    listColumns: [
      { key: "full_name", label: "Full Name", sortable: true },
      { key: "email_id", label: "Email", sortable: true },
      { key: "contact_no", label: "Contact" },
      { 
        key: "card_due_date", 
        label: "Due Date",
        render: (row: any) => {
          if (!row.card_due_date) return "—";
          const date = new Date(row.card_due_date);
          return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      },
    ],
  },
  customer_tax_details: {
    table: "customer_tax_details",
    title: "Customer Tax Details",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      { name: "pan_no", label: "PAN No", type: "text", required: true },
      { name: "aadhaar_no", label: "Aadhaar No", type: "text", required: false },
      // { name: "gst_type", label: "GST Type", type: "enum", required: true, enumValues: [
      //   "Regular",
      //   "Composition",
      //   "Casual",
      //   "Non-Resident",
      //   "UN Body",
      //   "SEZ"
      // ] }, // Removed as requested
    ],
    listColumns: [
      { key: "customer_name", label: "Customer" },
      { key: "pan_no", label: "PAN" },
      { key: "aadhaar_no", label: "Aadhaar" },
      // { key: "gst_type", label: "GST Type" }, // Removed as requested
    ],
  },
  card_details: {
    table: "cards",
    title: "Card Details",
    fields: [
      { 
        name: "customer_id", 
        label: "Customer", 
        type: "select", 
        required: true, 
        relation: { table: "customers", valueField: "id", labelField: "full_name" } 
      },
      { 
        name: "bank_name", 
        label: "Bank Name", 
        type: "enum", 
        required: true, 
        enumValues: [
          "State Bank of India",
          "HDFC Bank",
          "ICICI Bank",
          "Punjab National Bank",
          "Bank of Baroda",
          "Canara Bank",
          "Union Bank of India",
          "Axis Bank",
          "Kotak Mahindra Bank",
          "IndusInd Bank",
          "Yes Bank",
          "Federal Bank",
          "IDBI Bank",
          "RBL Bank"
        ] 
      },
      { 
        name: "card_type", 
        label: "Card Type", 
        type: "enum", 
        required: true, 
        enumValues: ["Credit Card", "Debit Card"] 
      },
      { 
        name: "card_name", 
        label: "Card Name", 
        type: "enum", 
        required: true, 
        enumValues: [
          // SBI
          "SBI SimplySAVE Credit Card",
          "SBI SimplyCLICK Credit Card",
          "SBI Prime Credit Card",
          "SBI Elite Credit Card",
          "SBI Classic Debit Card",
          "SBI Global Debit Card",
          "SBI Platinum International Debit Card",

          // HDFC
          "HDFC Moneyback Credit Card",
          "HDFC Regalia Credit Card",
          "HDFC Diners Club Black Credit Card",
          "HDFC Premium Debit Card",
          "HDFC Millennia Debit Card",
          "HDFC EasyShop Platinum Debit Card",

          // ICICI
          "ICICI Coral Credit Card",
          "ICICI Platinum Chip Credit Card",
          "ICICI Amazon Pay Credit Card",
          "ICICI Coral Debit Card",
          "ICICI Sapphiro Debit Card",
          "ICICI Expressions Debit Card",

          // Punjab National Bank (PNB)
          "PNB Global Classic Credit Card",
          "PNB Global Platinum Credit Card",
          "PNB Classic Debit Card",
          "PNB Gold Debit Card",

          // Bank of Baroda (BOB)
          "BOB Eterna Credit Card",
          "BOB Select Credit Card",
          "BOB Easy Debit Card",
          "BOB Premium Debit Card",

          // Canara Bank
          "Canara Global Gold Credit Card",
          "Canara Platinum Credit Card",
          "Canara Classic Debit Card",
          "Canara Platinum Debit Card",

          // Union Bank of India
          "Union Bank International Credit Card",
          "Union Platinum Credit Card",
          "Union Classic Debit Card",
          "Union Premium Debit Card",

          // Axis Bank
          "Axis Neo Credit Card",
          "Axis Magnus Credit Card",
          "Axis Flipkart Credit Card",
          "Axis Visa Platinum Debit Card",
          "Axis RuPay Platinum Debit Card",
          "Axis Priority Debit Card",

          // Kotak Mahindra Bank
          "Kotak Royale Signature Credit Card",
          "Kotak Urbane Gold Credit Card",
          "Kotak Classic Debit Card",
          "Kotak Privy League Debit Card",

          // IndusInd Bank
          "IndusInd Platinum Aura Credit Card",
          "IndusInd Iconia Credit Card",
          "IndusInd International Classic Debit Card",
          "IndusInd Titanium Debit Card",

          // Yes Bank
          "YES Prosperity Edge Credit Card",
          "YES First Exclusive Credit Card",
          "YES Prosperity Platinum Debit Card",
          "YES EMV Platinum Debit Card",

          // Federal Bank
          "Federal Visa Classic Credit Card",
          "Federal Platinum Credit Card",
          "Federal Visa Signature Debit Card",
          "Federal RuPay Premium Debit Card",

          // IDBI Bank
          "IDBI Aspire Platinum Credit Card",
          "IDBI Royale Signature Credit Card",
          "IDBI Classic Debit Card",
          "IDBI Platinum Debit Card",

          // RBL Bank
          "RBL Platinum Maxima Credit Card",
          "RBL ShopRite Credit Card",
          "RBL Titanium First Debit Card",
          "RBL Signature+ Debit Card"
        ],
        // Add card mapping for dynamic filtering
        cardsByBank: {
          "State Bank of India": {
            "Credit Card": [
              "SBI SimplySAVE Credit Card",
              "SBI SimplyCLICK Credit Card", 
              "SBI Prime Credit Card",
              "SBI Elite Credit Card"
            ],
            "Debit Card": [
              "SBI Classic Debit Card",
              "SBI Global Debit Card",
              "SBI Platinum International Debit Card"
            ]
          },
          "HDFC Bank": {
            "Credit Card": [
              "HDFC Moneyback Credit Card",
              "HDFC Regalia Credit Card",
              "HDFC Diners Club Black Credit Card"
            ],
            "Debit Card": [
              "HDFC Premium Debit Card",
              "HDFC Millennia Debit Card",
              "HDFC EasyShop Platinum Debit Card"
            ]
          },
          "ICICI Bank": {
            "Credit Card": [
              "ICICI Coral Credit Card",
              "ICICI Platinum Chip Credit Card",
              "ICICI Amazon Pay Credit Card"
            ],
            "Debit Card": [
              "ICICI Coral Debit Card",
              "ICICI Sapphiro Debit Card",
              "ICICI Expressions Debit Card"
            ]
          },
          "Punjab National Bank": {
            "Credit Card": [
              "PNB Global Classic Credit Card",
              "PNB Global Platinum Credit Card"
            ],
            "Debit Card": [
              "PNB Classic Debit Card",
              "PNB Gold Debit Card"
            ]
          },
          "Bank of Baroda": {
            "Credit Card": [
              "BOB Eterna Credit Card",
              "BOB Select Credit Card"
            ],
            "Debit Card": [
              "BOB Easy Debit Card",
              "BOB Premium Debit Card"
            ]
          },
          "Canara Bank": {
            "Credit Card": [
              "Canara Global Gold Credit Card",
              "Canara Platinum Credit Card"
            ],
            "Debit Card": [
              "Canara Classic Debit Card",
              "Canara Platinum Debit Card"
            ]
          },
          "Union Bank of India": {
            "Credit Card": [
              "Union Bank International Credit Card",
              "Union Platinum Credit Card"
            ],
            "Debit Card": [
              "Union Classic Debit Card",
              "Union Premium Debit Card"
            ]
          },
          "Axis Bank": {
            "Credit Card": [
              "Axis Neo Credit Card",
              "Axis Magnus Credit Card",
              "Axis Flipkart Credit Card"
            ],
            "Debit Card": [
              "Axis Visa Platinum Debit Card",
              "Axis RuPay Platinum Debit Card",
              "Axis Priority Debit Card"
            ]
          },
          "Kotak Mahindra Bank": {
            "Credit Card": [
              "Kotak Royale Signature Credit Card",
              "Kotak Urbane Gold Credit Card"
            ],
            "Debit Card": [
              "Kotak Classic Debit Card",
              "Kotak Privy League Debit Card"
            ]
          },
          "IndusInd Bank": {
            "Credit Card": [
              "IndusInd Platinum Aura Credit Card",
              "IndusInd Iconia Credit Card"
            ],
            "Debit Card": [
              "IndusInd International Classic Debit Card",
              "IndusInd Titanium Debit Card"
            ]
          },
          "Yes Bank": {
            "Credit Card": [
              "YES Prosperity Edge Credit Card",
              "YES First Exclusive Credit Card"
            ],
            "Debit Card": [
              "YES Prosperity Platinum Debit Card",
              "YES EMV Platinum Debit Card"
            ]
          },
          "Federal Bank": {
            "Credit Card": [
              "Federal Visa Classic Credit Card",
              "Federal Platinum Credit Card"
            ],
            "Debit Card": [
              "Federal Visa Signature Debit Card",
              "Federal RuPay Premium Debit Card"
            ]
          },
          "IDBI Bank": {
            "Credit Card": [
              "IDBI Aspire Platinum Credit Card",
              "IDBI Royale Signature Credit Card"
            ],
            "Debit Card": [
              "IDBI Classic Debit Card",
              "IDBI Platinum Debit Card"
            ]
          },
          "RBL Bank": {
            "Credit Card": [
              "RBL Platinum Maxima Credit Card",
              "RBL ShopRite Credit Card"
            ],
            "Debit Card": [
              "RBL Titanium First Debit Card",
              "RBL Signature+ Debit Card"
            ]
          }
        }
      },
      { 
        name: "card_number", 
        label: "Card Number", 
        type: "text", 
        placeholder: "XXXX XXXX XXXX XXXX" 
      },
      { 
        name: "due_date", 
        label: "Due Date", 
        type: "date" 
      },
      { name: "enable_defaults", label: "Enable Defaults", type: "boolean" },
      { name: "default_pos_type", label: "Default POS Type", type: "enum", enumValues: ["MP", "PH", "MOS", "Custom"] },
      { name: "custom_pos_type", label: "Custom POS Type", type: "text" },
      { name: "default_tax_rate", label: "Default Tax Rate %", type: "number" },
      { name: "default_mdr_rate", label: "Default MDR %", type: "number" },
    ],
    listColumns: [
      { key: "customer_name", label: "Customer" },
      { key: "bank_name", label: "Bank" },
      { key: "card_type", label: "Type" },
      { key: "card_name", label: "Name on Card" },
      { key: "card_number", label: "Card Number" },
      { 
        key: "due_date", 
        label: "Due Date",
        render: (row: any) => {
          if (!row.due_date) return "—";
          const date = new Date(row.due_date);
          return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      },
    ],
  },
  identity_documents: {
    table: "identity_documents",
    title: "Identity Documents",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      { name: "document_type", label: "Type", type: "enum", required: true, enumValues: ["Aadhaar Card", "PAN Card", "Voter ID"] },
      { name: "document_number", label: "Number", type: "text", required: true },
      { name: "document_image", label: "Image URL", type: "text", required: true },
    ],
    listColumns: [
      { key: "customer_name", label: "Customer" },
      { key: "document_type", label: "Type" },
      { key: "document_number", label: "Number" },
    ],
  },
  accounts: {
    table: "accounts",
    title: "Accounts",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      // { name: "opening_balance", label: "Opening Balance", type: "number", required: true }, // Removed as requested
      { name: "credit_allowed", label: "Credit Allowed", type: "boolean", required: true },
      { name: "credit_limit", label: "Credit Limit", type: "number", required: true },
      { name: "remark", label: "Remark", type: "textarea" },
      { name: "received", label: "Received", type: "number", required: true },
      { name: "pending_amount", label: "Pending Amount", type: "number", required: true },
    ],
    listColumns: [
      { key: "customer_name", label: "Customer" },
      // { key: "opening_balance", label: "Opening" }, // Removed as requested
      { key: "credit_allowed", label: "Credit Allowed" },
      { key: "pending_amount", label: "Pending" },
    ],
  },
  transactions: {
    table: "transactions",
    title: "Transactions",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      { name: "card_number", label: "Card Number", type: "select", relation: { table: "card_details", valueField: "card_number", labelField: "card_number" } },
      { name: "card_name", label: "Card Name", type: "text" },
      
      // Amount fields
      { name: "deposit_amount", label: "Deposit Amount", type: "number" },
      { name: "withdraw_amount", label: "Withdraw Amount", type: "number" },
      { name: "payable_amount", label: "Payable Amount", type: "number" },
      
      // Tax and charges
      { name: "pos_type", label: "POS Type", type: "enum", enumValues: ["MP", "PH", "MOS"] },
      { name: "tax_rate", label: "Tax Rate (%)", type: "number" },
      { name: "tax_amount", label: "Tax Amount", type: "number" },
              { name: "mdr_amount", label: "MDR %", type: "number" },
      { name: "mdr_charge_amount", label: "MDR Charge Amount", type: "number" },
      { name: "profit_amount", label: "Profit Amount", type: "number" },
      
      // Logic flags
      { name: "add_tax_to_withdraw", label: "Add Tax to Withdraw", type: "boolean" },
      
      // Calculated fields
      { name: "pending_amount", label: "Pending Amount", type: "number" },
      { name: "status", label: "Status", type: "enum", enumValues: ["Pending", "PAID", "Overpaid"] },
      
      // Metadata
      { name: "transaction_date", label: "Transaction Date", type: "datetime" },
    ],
    listColumns: [
      { 
        key: "transaction_date", 
        label: "Billing Date", 
        sortable: true,
        render: (row: any) => {
          if (!row.transaction_date) return "—";
          const date = new Date(row.transaction_date);
          return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      },
      { key: "customer_name", label: "Customer" },
      { key: "card_number", label: "Card Number" },
      { key: "card_name", label: "Card Name" },
      { key: "deposit_amount", label: "Deposit (₹)", sortable: true },
      { key: "withdraw_amount", label: "Withdraw (₹)", sortable: true },
      { key: "payable_amount", label: "Payable (₹)", sortable: true },
      { key: "pos_type", label: "POS Type" },
      { key: "tax_rate", label: "Tax %", sortable: true },
      { key: "tax_amount", label: "Tax (₹)", sortable: true },
      { key: "mdr_amount", label: "MDR %", sortable: true },
      { key: "mdr_charge_amount", label: "MDR Charge (₹)", sortable: true },
      { key: "profit_amount", label: "Profit (₹)", sortable: true },
      { key: "add_tax_to_withdraw", label: "Tax Added to Withdraw" },
      { 
        key: "pending_amount", 
        label: "Pending Amount (₹)", 
        sortable: true,
        render: (row: any) => {
          const amount = Number(row.pending_amount) || 0;
          return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(amount);
        }
      },
      { key: "status", label: "Status" },
    ],
  },
  customer_credits: {
    table: "customer_credits",
    title: "Customer Credits",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      { name: "account_id", label: "Account", type: "select", required: true, relation: { table: "accounts", valueField: "id", labelField: "id" } },
      { name: "type", label: "Type", type: "enum", required: true, enumValues: ["credit_given", "repayment"] },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "date", label: "Date", type: "datetime" },
      { name: "note", label: "Note", type: "textarea" },
    ],
    listColumns: [
      { 
        key: "date", 
        label: "Date", 
        sortable: true,
        render: (row: any) => {
          if (!row.date) return "—";
          const date = new Date(row.date);
          return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      },
      { key: "customer_id", label: "Customer" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount", sortable: true },
    ],
  },
  payment_alerts: {
    table: "payment_alerts",
    title: "Payment Alerts",
    fields: [
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      { name: "account_id", label: "Account", type: "select", required: true, relation: { table: "accounts", valueField: "id", labelField: "id" } },
      { name: "alert_message", label: "Message", type: "textarea" },
      { name: "due_date", label: "Due Date", type: "datetime" },
      { name: "is_paid", label: "Is Paid", type: "boolean" },
    ],
    listColumns: [
      { 
        key: "due_date", 
        label: "Due", 
        sortable: true,
        render: (row: any) => {
          if (!row.due_date) return "—";
          const date = new Date(row.due_date);
          return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      },
      { key: "customer_id", label: "Customer" },
      { key: "alert_message", label: "Message" },
      { key: "is_paid", label: "Paid?" },
    ],
  },
};


