# Test Files Directory

This folder contains sample files for testing the Payment Settlement & Reconciliation Platform.

## Folder Structure

```
test_files/
├── bank_transactions.csv      # Sample bank transaction file
├── merchant_transactions.csv  # Sample merchant transaction file
├── README.md                  # This file
└── exports/                   # All exported files are saved here
    ├── settlements_*.csv
    ├── transactions_*.csv
    └── merchants_*.csv
```

## Input Files

### Bank Files
- `bank_transactions.csv` - Sample bank transaction file with 10 transactions

### Merchant Files  
- `merchant_transactions.csv` - Sample merchant transaction file with 10 transactions

## Export Files

All exports from the application are automatically saved to the `exports/` folder:
- **settlements_[timestamp].csv** - Settlement report exports
- **transactions_[timestamp].csv** - Transaction data exports
- **merchants_[timestamp].csv** - Merchant summary exports

## File Format

All CSV files follow this format:
```
transaction_id,merchant_id,amount,currency,status,payment_gateway,reference_id,transaction_date
```

### Fields:
- **transaction_id**: Unique identifier for the transaction
- **merchant_id**: ID of the merchant (e.g., MER001, MER002)
- **amount**: Transaction amount in smallest currency unit
- **currency**: Currency code (e.g., INR, USD)
- **status**: Transaction status (SUCCESS, PENDING, FAILED)
- **payment_gateway**: Gateway used (BANK, RAZORPAY, STRIPE)
- **reference_id**: Reference ID from the payment gateway
- **transaction_date**: Date of transaction (YYYY-MM-DD)

## Usage

### Uploading Files
1. Navigate to File Upload in the application
2. Select the appropriate file type (Bank or Merchant)
3. Upload the CSV file
4. View the processing results

### Exporting Data
1. Navigate to Reports page
2. Generate a report (Daily, Merchant, etc.)
3. Click Export as CSV or PDF
4. Files are automatically saved to `exports/` folder
