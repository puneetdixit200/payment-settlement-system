require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const config = require('../config');
const { User, Merchant, Transaction, MessageTemplate } = require('../models');
const { ROLES, TRANSACTION_STATUS, TRANSACTION_SOURCE, PAYMENT_GATEWAY, RECONCILIATION_STATUS, SETTLEMENT_CYCLE, MERCHANT_STATUS } = require('../config/constants');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep data)
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Merchant.deleteMany({});
    await Transaction.deleteMany({});
    await MessageTemplate.deleteMany({});

    // Create Users
    console.log('Creating users...');
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@payreconcile.com',
      password: 'Admin@123',
      role: ROLES.ADMIN,
      status: 'ACTIVE'
    });

    const manager = await User.create({
      name: 'Manager User',
      email: 'manager@payreconcile.com',
      password: 'Manager@123',
      role: ROLES.MANAGER,
      status: 'ACTIVE'
    });

    console.log('Created users:', admin.email, manager.email);

    // Create Merchants
    console.log('Creating merchants...');
    const merchants = await Merchant.insertMany([
      {
        merchant_id: 'MER001',
        name: 'TechStore Electronics',
        email: 'payments@techstore.com',
        settlement_cycle: SETTLEMENT_CYCLE.DAILY,
        payment_gateway: PAYMENT_GATEWAY.RAZORPAY,
        status: MERCHANT_STATUS.ACTIVE,
        sla_hours: 24,
        contact_person: 'Rahul Kumar',
        phone: '+91-9876543210',
        created_by: admin._id
      },
      {
        merchant_id: 'MER002',
        name: 'Fashion Hub',
        email: 'accounts@fashionhub.com',
        settlement_cycle: SETTLEMENT_CYCLE.WEEKLY,
        payment_gateway: PAYMENT_GATEWAY.STRIPE,
        status: MERCHANT_STATUS.ACTIVE,
        sla_hours: 48,
        contact_person: 'Priya Sharma',
        phone: '+91-9876543211',
        created_by: admin._id
      },
      {
        merchant_id: 'MER003',
        name: 'GroceryMart',
        email: 'finance@grocerymart.com',
        settlement_cycle: SETTLEMENT_CYCLE.DAILY,
        payment_gateway: PAYMENT_GATEWAY.BANK,
        status: MERCHANT_STATUS.ACTIVE,
        sla_hours: 12,
        contact_person: 'Amit Patel',
        phone: '+91-9876543212',
        created_by: admin._id
      },
      {
        merchant_id: 'MER004',
        name: 'BookWorld',
        email: 'payments@bookworld.com',
        settlement_cycle: SETTLEMENT_CYCLE.MONTHLY,
        payment_gateway: PAYMENT_GATEWAY.RAZORPAY,
        status: MERCHANT_STATUS.ACTIVE,
        sla_hours: 72,
        contact_person: 'Sneha Gupta',
        phone: '+91-9876543213',
        created_by: admin._id
      },
      {
        merchant_id: 'MER005',
        name: 'HomeDecor Plus',
        email: 'settlements@homedecorplus.com',
        settlement_cycle: SETTLEMENT_CYCLE.WEEKLY,
        payment_gateway: PAYMENT_GATEWAY.STRIPE,
        status: MERCHANT_STATUS.ACTIVE,
        sla_hours: 36,
        contact_person: 'Vikram Singh',
        phone: '+91-9876543214',
        created_by: admin._id
      }
    ]);

    console.log(`Created ${merchants.length} merchants`);

    // Generate sample transactions
    console.log('Creating transactions...');
    const transactions = [];
    const now = new Date();
    
    for (let i = 0; i < 500; i++) {
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const transactionDate = new Date(now);
      transactionDate.setDate(transactionDate.getDate() - daysAgo);
      
      const amount = Math.floor(Math.random() * 50000) + 100;
      const source = i % 2 === 0 ? TRANSACTION_SOURCE.BANK : TRANSACTION_SOURCE.MERCHANT;
      const status = Math.random() > 0.1 
        ? TRANSACTION_STATUS.SUCCESS 
        : (Math.random() > 0.5 ? TRANSACTION_STATUS.PENDING : TRANSACTION_STATUS.FAILED);
      
      const txnId = `TXN${Date.now().toString(36).toUpperCase()}${i.toString().padStart(4, '0')}`;
      
      transactions.push({
        transaction_id: txnId,
        merchant_id: merchant.merchant_id,
        merchant: merchant._id,
        amount,
        currency: 'INR',
        payment_gateway: merchant.payment_gateway,
        status,
        source,
        reference_id: `REF${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        reconciliation_status: RECONCILIATION_STATUS.PENDING,
        transaction_date: transactionDate,
        sla_hours: merchant.sla_hours,
        created_by: admin._id
      });
    }

    // Create matching pairs for reconciliation demo
    for (let i = 0; i < 100; i++) {
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const daysAgo = Math.floor(Math.random() * 15);
      const transactionDate = new Date(now);
      transactionDate.setDate(transactionDate.getDate() - daysAgo);
      
      const amount = Math.floor(Math.random() * 30000) + 500;
      const txnId = `MATCH${Date.now().toString(36).toUpperCase()}${i.toString().padStart(4, '0')}`;
      
      // Bank transaction
      transactions.push({
        transaction_id: txnId,
        merchant_id: merchant.merchant_id,
        merchant: merchant._id,
        amount,
        currency: 'INR',
        payment_gateway: PAYMENT_GATEWAY.BANK,
        status: TRANSACTION_STATUS.SUCCESS,
        source: TRANSACTION_SOURCE.BANK,
        reference_id: `BREF${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        reconciliation_status: RECONCILIATION_STATUS.PENDING,
        transaction_date: transactionDate,
        sla_hours: merchant.sla_hours,
        created_by: admin._id
      });

      // Merchant transaction (for matching)
      transactions.push({
        transaction_id: txnId,
        merchant_id: merchant.merchant_id,
        merchant: merchant._id,
        amount,
        currency: 'INR',
        payment_gateway: merchant.payment_gateway,
        status: TRANSACTION_STATUS.SUCCESS,
        source: TRANSACTION_SOURCE.MERCHANT,
        reference_id: `MREF${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        reconciliation_status: RECONCILIATION_STATUS.PENDING,
        transaction_date: transactionDate,
        sla_hours: merchant.sla_hours,
        created_by: admin._id
      });
    }

    await Transaction.insertMany(transactions);
    console.log(`Created ${transactions.length} transactions`);

    // Create message templates
    console.log('Creating message templates...');
    await MessageTemplate.insertMany([
      {
        name: 'Transaction Failed Alert',
        type: 'EMAIL',
        trigger: 'TRANSACTION_FAILED',
        subject: 'Payment Failed - Action Required',
        body: `Dear {{merchant_name}},

Transaction {{transaction_id}} for amount {{currency}} {{amount}} has failed.

Transaction Details:
- Transaction ID: {{transaction_id}}
- Amount: {{currency}} {{amount}}
- Date: {{transaction_date}}
- Gateway: {{payment_gateway}}

Please review this transaction in your dashboard.

Best regards,
Payment Settlement Team`,
        variables: [
          { name: 'merchant_name', description: 'Merchant name' },
          { name: 'transaction_id', description: 'Transaction ID' },
          { name: 'amount', description: 'Transaction amount' },
          { name: 'currency', description: 'Currency code' },
          { name: 'transaction_date', description: 'Transaction date' },
          { name: 'payment_gateway', description: 'Payment gateway used' }
        ],
        is_active: true,
        created_by: admin._id
      },
      {
        name: 'SLA Breach Alert',
        type: 'EMAIL',
        trigger: 'SLA_BREACH',
        subject: 'SLA Breach Alert - Settlement Delayed',
        body: `Dear {{merchant_name}},

We detected an SLA breach for transaction {{transaction_id}}.

Details:
- Transaction ID: {{transaction_id}}
- Expected Settlement: {{sla_hours}} hours
- Actual Time: {{actual_hours}} hours
- Breach Duration: {{breach_hours}} hours

Our team is working to resolve this issue.

Best regards,
Payment Settlement Team`,
        variables: [
          { name: 'merchant_name', description: 'Merchant name' },
          { name: 'transaction_id', description: 'Transaction ID' },
          { name: 'sla_hours', description: 'Expected SLA in hours' },
          { name: 'actual_hours', description: 'Actual settlement time' },
          { name: 'breach_hours', description: 'Hours exceeded' }
        ],
        is_active: true,
        created_by: admin._id
      },
      {
        name: 'Daily Summary',
        type: 'EMAIL',
        trigger: 'DAILY_SUMMARY',
        subject: 'Daily Settlement Summary - {{date}}',
        body: `Dear {{merchant_name}},

Here is your daily settlement summary for {{date}}:

Summary:
- Total Transactions: {{total_transactions}}
- Successful: {{success_count}}
- Failed: {{failed_count}}
- Pending: {{pending_count}}
- Total Amount: {{currency}} {{total_amount}}

For detailed information, please visit your dashboard.

Best regards,
Payment Settlement Team`,
        is_active: true,
        created_by: admin._id
      }
    ]);

    console.log('Created message templates');

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Database Seeded Successfully!                        ║
║                                                           ║
║   Users:                                                  ║
║   - admin@payreconcile.com / Admin@123 (Admin)           ║
║   - manager@payreconcile.com / Manager@123 (Manager)     ║
║                                                           ║
║   Merchants: ${merchants.length}                                         ║
║   Transactions: ${transactions.length}                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
