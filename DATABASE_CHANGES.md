# Database Changes for Add Transactions Form

## Overview
This document outlines the database changes made to support the new Add Transactions form with card-specific tracking and tax calculations.

## Database Schema Changes

### 1. Updated `transactions` Table

#### New Fields Added:
- `deposit_amount` DECIMAL(10,2) - Amount deposited
- `withdraw_amount` DECIMAL(10,2) - Amount withdrawn
- `payable_amount` DECIMAL(10,2) - Total amount payable (withdraw + tax if applicable)
- `tax_rate` DECIMAL(5,2) - Tax rate percentage
- `tax_amount` DECIMAL(10,2) - Calculated tax amount
- `mdr_amount` DECIMAL(5,2) - MDR rate percentage
- `mdr_charge_amount` DECIMAL(10,2) - Calculated MDR charge amount
- `profit_amount` DECIMAL(10,2) - Calculated profit amount
- `add_tax_to_withdraw` BOOLEAN - Flag to add tax to withdraw amount
- `pending_amount` DECIMAL(10,2) - Calculated pending amount
- `status` VARCHAR(20) - Transaction status (Pending/PAID/Overpaid)
- `created_at` TIMESTAMPTZ - Record creation timestamp

#### Modified Fields:
- `card_number` VARCHAR(20) - Now references card_details.card_number
- `card_name` VARCHAR(100) - Card name for display

#### Removed Fields:
- `account_id` - No longer needed
- `transaction_type` - Replaced with deposit_amount/withdraw_amount
- `amount` - Replaced with deposit_amount/withdraw_amount
- `tax` - Replaced with tax_amount
- `charges` - Replaced with mdr_charge_amount
- `profit` - Replaced with profit_amount

### 2. Updated `card_details` Table

#### New Fields Added:
- `card_number` VARCHAR(20) UNIQUE - Unique card number
- `due_date` DATE - Card due date

## Migration Script

Run the migration script to update your existing database:

```sql
-- Run the migration file: migrations/update_transactions_table.sql
```

This script will:
1. Add all new columns to the transactions table
2. Add new columns to the card_details table
3. Create necessary indexes for performance
4. Migrate existing data (if any)
5. Add constraints and foreign keys

## API Changes

### 1. Updated Transaction API (`/api/[table]/route.ts`)
- Modified to handle new transaction form fields
- Added automatic calculation of pending amount and status
- Updated validation logic for new fields

### 2. New Card Pending Amounts API (`/api/card-pending-amounts/route.ts`)
- GET: Returns card-wise pending amounts for all customers
- POST: Returns pending amount for a specific card

## New Components

### 1. CardPendingAmounts Component
- Displays card-wise pending amounts grouped by customer
- Shows transaction counts and status for each card
- Color-coded pending amounts (red for pending, green for overpaid)

### 2. Updated TransactionFormModal
- Supports all new form fields
- Automatic calculations for tax, MDR, and pending amounts
- Card-specific transaction tracking

## Business Logic

### Pending Amount Calculation

#### When "Add Tax Amount to Withdraw Amount" is CHECKED:
- Payable Amount = Withdraw Amount + Tax Amount
- Pending Amount = Deposit Amount - Withdraw Amount

#### When "Add Tax Amount to Withdraw Amount" is NOT CHECKED:
- Payable Amount = Withdraw Amount
- Pending Amount = (Deposit Amount - Withdraw Amount) + Tax Amount

### Status Logic
- **PAID**: When pending amount = 0
- **Pending**: When pending amount > 0
- **Overpaid**: When pending amount < 0

## Card-wise Pending Amount Tracking

The system now tracks pending amounts per card, allowing you to:
1. See which specific cards have pending amounts
2. Track multiple cards per customer separately
3. Calculate total pending amounts per customer across all cards
4. Display transaction counts per card

## Usage Examples

### Example 1: Customer with 2 cards
- Card 1: ₹0 pending amount
- Card 2: ₹500 pending amount
- Display: Shows pending amount only for Card 2

### Example 2: Customer with multiple pending cards
- Card 1: ₹300 pending amount
- Card 2: ₹200 pending amount
- Display: Shows both cards with their respective pending amounts

## Performance Considerations

### Indexes Created:
- `idx_transactions_customer_id` - For customer-based queries
- `idx_transactions_card_number` - For card-based queries
- `idx_transactions_date` - For date-based queries
- `idx_card_details_customer_id` - For customer-card relationships
- `idx_card_details_card_number` - For card number lookups

### Query Optimization:
- Card pending amounts are calculated using efficient SQL aggregations
- Results are cached and can be refreshed on demand
- Pagination support for large datasets

## Testing

After implementing these changes:

1. **Test the migration script** on a backup database first
2. **Verify existing data** is properly migrated
3. **Test the new Add Transactions form** with various scenarios
4. **Verify card-wise pending amounts** are calculated correctly
5. **Test the API endpoints** for proper data handling

## Rollback Plan

If you need to rollback these changes:

1. Restore from database backup
2. Or run the commented rollback statements in the migration script
3. Revert the code changes to the previous version

## Support

For questions or issues with these database changes, refer to:
- The migration script comments
- The API route implementations
- The component source code
- This documentation
