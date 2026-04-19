import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkCustomer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const users = await db.collection('users').find({ 
      email: 'customer@test.com' 
    }).toArray();

    if (users.length === 0) {
      console.log('❌ Customer not found! Let\'s create one...');
      
      // Create customer with proper password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('customer123', salt);
      
      await db.collection('users').insertOne({
        email: 'customer@test.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Customer',
        phone: '09123456789',
        address: 'Tabing Ilog Marilao, Bulacan',
        role: 'customer',
        termsAccepted: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Customer created successfully!');
    } else {
      console.log('✅ Customer found:', users[0].email);
      console.log('Customer data:', users[0]);
      
      // Test password
      const isValid = await bcrypt.compare('customer123', users[0].password);
      console.log('Password valid:', isValid);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

checkCustomer();