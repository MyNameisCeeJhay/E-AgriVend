import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// ===== IMPORT YOUR ACTUAL MODELS =====
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Return from './models/Return.js';
import Rating from './models/Rating.js';
import Message from './models/Message.js';
import Product from './models/Product.js';
import Machine from './models/Machine.js';
import RefundRequest from './models/RefundRequest.js';

const seedDatabase = async () => {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Transaction.deleteMany({});
    await Return.deleteMany({});
    await Rating.deleteMany({});
    await Message.deleteMany({});
    await RefundRequest.deleteMany({});
    await Machine.deleteMany({});
    console.log('✅ Data cleared\n');

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const staffPassword = await bcrypt.hash('staff123', salt);

    // ===== CREATE PRODUCTS =====
    console.log('📦 Creating Products...');
    const sinandomeng = await Product.create({
      id: 1,
      name: 'Sinandomeng Rice',
      price: 54,
      isArchived: false
    });
    
    const dinorado = await Product.create({
      id: 2,
      name: 'Dinorado Rice',
      price: 65,
      isArchived: false
    });
    console.log(`   ✅ Created: ${sinandomeng.name}, ${dinorado.name}\n`);

    // ===== CREATE USERS (Admin and Staff only) =====
    console.log('👥 Creating Users (Admin & Staff)...');
    
    const admin = await User.create({
      email: 'admin@agrivend.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      termsAccepted: true,
      isActive: true
    });
    
    const staff1 = await User.create({
      email: 'staff@agrivend.com',
      password: staffPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: 'staff',
      termsAccepted: true,
      isActive: true
    });
    
    const staff2 = await User.create({
      email: 'maria@agrivend.com',
      password: staffPassword,
      firstName: 'Maria',
      lastName: 'Santos',
      role: 'staff',
      termsAccepted: true,
      isActive: true
    });
    
    console.log(`   ✅ Admin: ${admin.email}`);
    console.log(`   ✅ Staff: ${staff1.email}, ${staff2.email}\n`);

    // ===== CREATE TRANSACTIONS =====
    console.log('💰 Creating Transactions...');
    
    const transaction1 = await Transaction.create({
      transactionId: 'TXN-' + Date.now().toString(36).toUpperCase(),
      user: null,  // No customer account
      product: sinandomeng._id,
      productName: sinandomeng.name,
      quantityKg: 2.5,
      pricePerKg: sinandomeng.price,
      amountPaid: 135,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      recordedBy: staff1._id,
      notes: 'Walk-in customer'
    });
    
    const transaction2 = await Transaction.create({
      transactionId: 'TXN-' + (Date.now() + 1000).toString(36).toUpperCase(),
      user: null,
      product: dinorado._id,
      productName: dinorado.name,
      quantityKg: 1.5,
      pricePerKg: dinorado.price,
      amountPaid: 97.5,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      recordedBy: admin._id,
      notes: 'Walk-in customer'
    });
    console.log(`   ✅ Created ${transaction1.transactionId} recorded by staff`);
    console.log(`   ✅ Created ${transaction2.transactionId} recorded by admin\n`);

    // ===== CREATE RETURNS =====
    console.log('🔄 Creating Returns...');
    
    const return1 = await Return.create({
      returnId: 'RET-' + Date.now().toString(36).toUpperCase(),
      transaction: transaction1._id,
      transactionId: transaction1.transactionId,
      user: null,
      riceType: 'Sinandomeng',
      quantityKg: 2.5,
      amountPaid: 135,
      returnReason: 'Product was damaged',
      status: 'PENDING'
    });
    console.log(`   ✅ Created return: ${return1.returnId}\n`);

    // ===== CREATE MACHINE RATINGS =====
    console.log('⭐ Creating Machine Ratings...');
    
    const rating1 = await Rating.create({
      user: null,
      transaction: null,
      transactionId: null,
      rating: 5,
      comment: 'Great machine, easy to use!',
      commentType: 'suggestion',
      isVisible: true
    });
    console.log(`   ✅ Created rating: ${rating1.rating} stars\n`);

    // ===== CREATE MESSAGES =====
    console.log('💬 Creating Messages...');
    
    const message1 = await Message.create({
      user: null,
      subject: 'Question about machine',
      message: 'How do I request a return if something goes wrong?',
      status: 'unread'
    });
    console.log(`   ✅ Created message: "${message1.subject}"\n`);

    // ===== CREATE REFUND REQUEST =====
    console.log('💰 Creating Refund Request...');
    
    const refund = await RefundRequest.create({
      fullName: 'Walk-in Customer',
      email: 'customer@example.com',
      transactionNumber: transaction1.transactionId,
      transaction: transaction1._id,
      user: null,
      transactionDate: new Date().toISOString().split('T')[0],
      transactionTime: new Date().toTimeString().split(' ')[0],
      grainType: 'Sinandomeng',
      selectedQuantity: 2.5,
      amountInserted: 135,
      refundReason: 'Wrong product received',
      description: 'I received Dinorado instead of Sinandomeng',
      status: 'PENDING'
    });
    console.log(`   ✅ Created refund request for transaction: ${refund.transactionNumber}\n`);

    // ===== CREATE MACHINE DATA =====
    console.log('🤖 Creating Machine Data...');
    
    const machine = await Machine.create({
      storage1: {
        name: sinandomeng.name,
        productId: sinandomeng._id,
        pricePerKg: sinandomeng.price,
        currentWeight: 15.5,
        maxCapacity: 20,
        percentage: 77.5,
        status: 'Normal',
        isLow: false
      },
      storage2: {
        name: dinorado.name,
        productId: dinorado._id,
        pricePerKg: dinorado.price,
        currentWeight: 8.2,
        maxCapacity: 20,
        percentage: 41,
        status: 'Low',
        isLow: true
      },
      battery: {
        percentage: 78,
        voltage: 12.4,
        status: 'Good',
        health: 'Good',
        isCharging: true
      },
      machineStatus: {
        isOnline: true,
        temperature: 32.5,
        doorStatus: 'Closed',
        securityStatus: 'Safe'
      }
    });
    console.log('✅ Machine data created\n');

    // ===== SUMMARY =====
    console.log('=================================');
    console.log('✅ DATABASE SEEDED SUCCESSFULLY!');
    console.log('=================================\n');
    
    console.log('📝 Login credentials:');
    console.log('   Admin: admin@agrivend.com / admin123');
    console.log('   Staff: staff@agrivend.com / staff123');
    console.log('   Staff: maria@agrivend.com / staff123\n');
    
    console.log('🔗 RELATIONSHIPS ESTABLISHED:');
    console.log(`   ✅ transactions.recordedBy → ${transaction1.recordedBy} (Staff)`);
    console.log(`   ✅ transactions.product → ${transaction1.product} (Product)`);
    console.log(`   ✅ returns.transaction → ${return1.transaction} (Transaction)`);
    console.log(`   ✅ refund.transaction → ${refund.transaction} (Transaction)`);
    console.log(`   ✅ machine.storage1.productId → ${machine.storage1.productId} (Product)`);
    console.log(`   ✅ machine.storage2.productId → ${machine.storage2.productId} (Product)\n`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();