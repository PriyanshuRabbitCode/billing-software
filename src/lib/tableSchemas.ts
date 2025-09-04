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
      { name: "customer_id", label: "Customer", type: "select", required: true, relation: { table: "customers", valueField: "id", labelField: "full_name" } },
      { name: "bank_name", label: "Bank Name", type: "enum", required: true, enumValues: [
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
      ] },
      { name: "card_type", label: "Card Type", type: "enum", required: true, enumValues: ["Credit Card", "Debit Card"] },
      { name: "card_name", label: "Card Name", type: "enum", required: true, enumValues: [
        // Credit Cards
        "SBI SimplySAVE Credit Card",
        "SBI SimplyCLICK Credit Card",
        "HDFC Moneyback Credit Card",
        "HDFC Regalia Credit Card",
        "ICICI Coral Credit Card",
        "ICICI Platinum Credit Card",
        "Axis Neo Credit Card",
        "Axis Magnus Credit Card",
        "Kotak Royale Credit Card",
        "Kotak Urbane Credit Card",
        // Debit Cards
        "SBI Classic Debit Card",
        "SBI Global Debit Card",
        "HDFC Premium Debit Card",
        "HDFC International Debit Card",
        "ICICI Coral Debit Card",
        "ICICI Sapphiro Debit Card",
        "Axis Visa Platinum Debit Card",
        "Axis RuPay Platinum Debit Card",
        "Kotak Classic Debit Card",
        "Kotak Premium Debit Card"
      ] },
      { name: "card_number", label: "Card Number", type: "text", placeholder: "XXXX XXXX XXXX XXXX" },
      { name: "due_date", label: "Due Date", type: "datetime" },
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


