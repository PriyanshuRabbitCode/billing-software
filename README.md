# Billing Software

A comprehensive billing and transaction management system built with Next.js, TypeScript, and PostgreSQL.

## Features

### Transaction Management
- **Credit and Debit Transactions**: Support for both credit and debit transaction types
- **Base Amount System**: Only base amounts are tracked (tax is paid immediately)
- **Dynamic Fee Calculation**: 
  - Tax calculation based on configurable rates (3.50%, 3.00%, 2.80%, 2.50%, 2.00%, 1.90%, 1.80%)
  - MDR (Merchant Discount Rate) calculation
  - Profit calculation (Tax - MDR)
  - No fixed charges - all calculations are percentage-based
- **POS Type Support**: MP, PH, MOS with different tax/MDR rate combinations
- **Credit Transactions**: No charges, tax, MDR, or profit applied

### Card-Based Pending Amount System
The system automatically calculates and tracks pending amounts for each card number, allowing customers to have separate pending amounts for different cards:

**Calculation Logic:**
- **Debit transactions** (base amount only) increase the pending amount for the specific card
- **Credit transactions** decrease the pending amount for the specific card
- **Tax is always paid immediately** with the transaction
- **Card Pending Amount = Total Debit Base Amounts for Card - Total Credit Base Amounts for Card**

**Example Scenarios:**
1. Customer has 2 cards: HDFC Credit Card & Axis Debit Card
2. Customer debited ₹10,000 from HDFC Credit Card (base ₹9,709 + tax ₹291) → HDFC Card Pending: ₹9,709
3. Customer debited ₹5,000 from Axis Debit Card (base ₹4,854 + tax ₹146) → Axis Card Pending: ₹4,854
4. Customer credited ₹2,000 to HDFC Credit Card → HDFC Card Pending: ₹7,709, Axis Card Pending: ₹4,854
5. Customer credited ₹7,709 to HDFC Credit Card → HDFC Card Pending: ₹0, Axis Card Pending: ₹4,854

**Total Pending Amount:**
- Sum of all individual card pending amounts across all customers
- Example: HDFC Card has ₹10 pending, Axis Card has ₹20 pending → Total: ₹30

**Features:**
- Automatic calculation on transaction creation/update per card
- Visual indicators: Yellow for pending amounts, Red for high amounts (>₹10,000)
- Manual recalculation button for all cards
- Dedicated Card Pending Amounts page for better visibility
- Card number tracking in transactions table

### Customer Management
- Complete customer profiles with tax details
- Card management with due date tracking
- Identity document storage
- Account management with credit limits

### Dashboard
- Real-time statistics and analytics
- Recent transaction history
- Upcoming due date alerts
- Revenue and pending payment tracking

## Database Schema

### Key Tables
- `customers`: Customer information
- `transactions`: Transaction records with fee calculations and card tracking
- `card_pending_amounts`: Card-specific pending amounts
- `card_details`: Customer card information
- `customer_tax_details`: Tax-related information
- `identity_documents`: Document storage

### Card Pending Amount Implementation
The card pending amount is stored in the `card_pending_amounts` table and is automatically calculated based on transaction history per card number. The calculation happens:

1. **On Transaction Creation/Update**: Via `/api/calculate-card-pending-amount` endpoint
2. **On Page Load**: Ensures data consistency
3. **Manual Recalculation**: Via "Recalculate All" button on Card Pending Amounts page

## API Endpoints

### Transaction Management
- `GET /api/transactions` - List all transactions
- `POST /api/transactions` - Create new transaction
- `PATCH /api/transactions/[id]` - Update transaction
- `DELETE /api/transactions/[id]` - Delete transaction

### Card Pending Amount Management
- `GET /api/calculate-card-pending-amount` - Recalculate all card pending amounts
- `POST /api/calculate-card-pending-amount` - Calculate pending for specific card
- `GET /api/card-pending-amounts` - Get all card pending amounts
- `POST /api/card-pending-amounts` - Get total pending amount across all cards

### Customer Management
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/[id]` - Get customer details

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up PostgreSQL database
4. Run migrations
5. Start development server: `npm run dev`

## Usage

1. **Add Customers**: Create customer profiles with tax details and cards
2. **Create Transactions**: Add debit/credit transactions with automatic fee calculation
3. **Monitor Pending Amounts**: View pending amounts in the transactions table
4. **Track Revenue**: Monitor total revenue and profit in the dashboard

## Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth
- **UI Components**: Custom components with shadcn/ui styling
