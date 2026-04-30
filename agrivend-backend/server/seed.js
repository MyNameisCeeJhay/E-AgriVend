import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory (works in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the parent directory (where .env is located)
// This tries multiple possible locations to be safe
const envPaths = [
  path.join(__dirname, '../.env'),           // server/../.env
  path.join(__dirname, '../../.env'),         // server/../../.env
  path.join(process.cwd(), '.env'),           // current working directory
];

let envLoaded = false;
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`✅ Loaded .env from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error('❌ Could not load .env file from any location');
  console.error('   Tried paths:', envPaths);
  process.exit(1);
}

// Debug: Check if URI is loaded
console.log('\n🔍 Environment Check:');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ Not found');
if (process.env.MONGODB_URI) {
  // Hide password for security
  const hiddenUri = process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@');
  console.log('   Connection string:', hiddenUri);
}

// Define schemas with STAFF role added
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'customer', 'staff'], default: 'customer' },  // ADDED 'staff'
  termsAccepted: { type: Boolean, default: false },
  termsAcceptedAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const termsSchema = new mongoose.Schema({
  version: { type: String, required: true },
  content: { type: String, required: true },
  effectiveDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const sensorSchema = new mongoose.Schema({
  container1Level: { type: Number, default: 20 },
  container2Level: { type: Number, default: 20 },
  container1Stock: { type: String, enum: ['OK', 'LOW', 'EMPTY'], default: 'OK' },
  container2Stock: { type: String, enum: ['OK', 'LOW', 'EMPTY'], default: 'OK' },
  batteryVoltage: { type: Number, default: 12.5 },
  batteryPercentage: { type: Number, default: 100 },
  solarPanelVoltage: { type: Number, default: 0 },
  solarCharging: { type: Boolean, default: false },
  temperature: { type: Number, default: 25 },
  doorStatus: { type: String, enum: ['OPEN', 'CLOSED'], default: 'CLOSED' },
  machineStatus: { type: String, enum: ['ACTIVE', 'ERROR', 'MAINTENANCE'], default: 'ACTIVE' }
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  riceType: { type: String, enum: ['Sinandomeng', 'Dinorado'], required: true },
  quantityKg: { type: Number, required: true },
  pricePerKg: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['CASH', 'CARD', 'QR'], default: 'CASH' },
  status: { type: String, enum: ['COMPLETED', 'FAILED', 'REFUNDED'], default: 'COMPLETED' }
}, { timestamps: true });

const returnSchema = new mongoose.Schema({
  returnId: { type: String, required: true, unique: true },
  transactionId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  riceType: { type: String, enum: ['Sinandomeng', 'Dinorado'], required: true },
  quantityKg: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  returnReason: { type: String, required: true },
  receiptFilename: { type: String },
  receiptPath: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  adminNotes: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date }
}, { timestamps: true });

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['UNREAD', 'READ', 'REPLIED'], default: 'UNREAD' },
  adminReply: { type: String, default: '' },
  repliedAt: { type: Date },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Create models
const User = mongoose.model('User', userSchema);
const TermsAgreement = mongoose.model('TermsAgreement', termsSchema);
const SensorData = mongoose.model('SensorData', sensorSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Return = mongoose.model('Return', returnSchema);
const Rating = mongoose.model('Rating', ratingSchema);
const Message = mongoose.model('Message', messageSchema);

const seedDatabase = async () => {
  try {
    console.log('\n🔌 Connecting to MongoDB Atlas...');
    
    // Check if URI exists
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }
    
    // Connect to MongoDB (no deprecated options needed)
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas successfully');
    
    // Clear existing data (optional)
    console.log('\n🗑️  Clearing existing data...');
    await User.deleteMany({});
    await TermsAgreement.deleteMany({});
    await SensorData.deleteMany({});
    await Transaction.deleteMany({});
    await Return.deleteMany({});
    await Rating.deleteMany({});
    await Message.deleteMany({});
    console.log('✅ Existing data cleared');

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const customerPassword = await bcrypt.hash('customer123', salt);
    const staffPassword = await bcrypt.hash('staff123', salt);  // ADDED STAFF PASSWORD

    // Create admin user
    const admin = await User.create({
      email: 'admin@agrivend.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      termsAccepted: true,
      isActive: true
    });
    console.log('✅ Admin created:', admin.email);

    // Create customer user
    const customer = await User.create({
      email: 'customer@test.com',
      password: customerPassword,
      firstName: 'Test',
      lastName: 'Customer',
      phone: '09123456789',
      address: 'Tabing Ilog Marilao, Bulacan',
      role: 'customer',
      termsAccepted: true,
      isActive: true
    });
    console.log('✅ Customer created:', customer.email);

    // Create staff user - ADDED
    const staff = await User.create({
      email: 'staff@agrivend.com',
      password: staffPassword,
      firstName: 'John',
      lastName: 'Doe',
      phone: '09123456789',
      address: 'Staff Office',
      role: 'staff',
      termsAccepted: true,
      isActive: true
    });
    console.log('✅ Staff created:', staff.email);

    // Create second staff user - ADDED
    const staff2 = await User.create({
      email: 'maria@agrivend.com',
      password: staffPassword,
      firstName: 'Maria',
      lastName: 'Santos',
      phone: '09123456780',
      address: 'Staff Office 2',
      role: 'staff',
      termsAccepted: true,
      isActive: true
    });
    console.log('✅ Staff created:', staff2.email);

    // Create terms agreement
    const terms = await TermsAgreement.create({
      version: '1.0',
      content: `BY USING AGRIVEND SERVICES, YOU AGREE TO THE FOLLOWING TERMS AND CONDITIONS:

1. ACCEPTANCE OF TERMS
By accessing and using the AgriVend rice vending machine and associated services, you accept and agree to be bound by these Terms and Conditions.

2. MACHINE USAGE
- The vending machine accepts both coins and bills as payment.
- All transactions are final unless there is a machine malfunction.
- The machine dispenses rice based on the exact value of payment inserted.
- Maximum transaction limit is 5kg per customer.

3. RETURNS AND REFUNDS
- Returns are accepted only for machine malfunctions or incorrect dispensing.
- Return requests must be submitted within 24 hours of purchase.
- Valid receipt or proof of purchase is required for all returns.
- Refunds will be processed within 3-5 business days upon approval.

4. USER ACCOUNTS
- You are responsible for maintaining the confidentiality of your account.
- You must provide accurate and complete information when registering.
- We reserve the right to suspend or terminate accounts for violations.

5. PRIVACY POLICY
- We collect personal information necessary for transaction processing.
- Your data will not be shared with third parties without consent.
- Transaction records are stored for reporting and analysis purposes.

6. LIMITATION OF LIABILITY
- AgriVend is not liable for any indirect or consequential damages.
- Our maximum liability shall not exceed the amount paid for the product.

7. CHANGES TO TERMS
- We reserve the right to modify these terms at any time.
- Continued use of the service constitutes acceptance of new terms.

8. CONTACT INFORMATION
For questions or concerns, please contact:
Email: support@agrivend.com
Store: GC Rice & Trading Store, Loma De Gato, Marilao, Bulacan

Last updated: ${new Date().toLocaleDateString()}`,
      isActive: true
    });
    console.log('✅ Terms agreement created');

    // Create sample sensor data
    const sensorData = await SensorData.create({
      container1Level: 15.5,
      container2Level: 8.2,
      container1Stock: 'OK',
      container2Stock: 'LOW',
      batteryPercentage: 78.5,
      batteryVoltage: 12.4,
      solarPanelVoltage: 18.2,
      solarCharging: true,
      temperature: 32.5,
      doorStatus: 'CLOSED',
      machineStatus: 'ACTIVE'
    });
    console.log('✅ Sample sensor data created');

    // Create sample transaction
    const transaction = await Transaction.create({
      transactionId: 'TXN-' + Date.now().toString(36).toUpperCase(),
      user: customer._id,
      riceType: 'Sinandomeng',
      quantityKg: 2.5,
      pricePerKg: 54,
      amountPaid: 135,
      paymentMethod: 'CASH',
      status: 'COMPLETED'
    });
    console.log('✅ Sample transaction created');

    // Create sample rating
    const rating = await Rating.create({
      user: customer._id,
      transactionId: transaction.transactionId,
      rating: 5,
      comment: 'Great machine, easy to use!'
    });
    console.log('✅ Sample rating created');

    // Create sample message
    const message = await Message.create({
      user: customer._id,
      subject: 'Question about machine',
      message: 'How do I request a return if something goes wrong?',
      status: 'UNREAD'
    });
    console.log('✅ Sample message created');

    console.log('\n=================================');
    console.log('✅ DATABASE SEEDED SUCCESSFULLY!');
    console.log('=================================\n');
    console.log('📝 Login credentials:');
    console.log('   Admin: admin@agrivend.com / admin123');
    console.log('   Customer: customer@test.com / customer123');
    console.log('   Staff: staff@agrivend.com / staff123');
    console.log('   Staff: maria@agrivend.com / staff123');
    console.log('\n📊 Collections populated:');
    console.log('   - users (4 users)');
    console.log('   - termsagreements (1 document)');
    console.log('   - sensordatas (1 document)');
    console.log('   - transactions (1 document)');
    console.log('   - ratings (1 document)');
    console.log('   - messages (1 document)');
    console.log('\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error.message);
    if (error.message.includes('bad auth')) {
      console.log('\n🔧 Authentication failed - check your password in .env');
      console.log('   Current MONGODB_URI:', process.env.MONGODB_URI?.replace(/:[^:]*@/, ':****@'));
    }
    process.exit(1);
  }
};

seedDatabase();