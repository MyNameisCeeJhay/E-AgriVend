import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const ultimateFix = async () => {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Delete ALL users
    await usersCollection.deleteMany({});
    console.log('🗑️ All users deleted\n');

    // Generate fresh hashes
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const staffHash = await bcrypt.hash('staff123', salt);

    console.log('Admin hash created:', adminHash.substring(0, 30) + '...');
    console.log('Staff hash created:', staffHash.substring(0, 30) + '...\n');

    // Insert Admin
    await usersCollection.insertOne({
      email: 'admin@agrivend.com',
      password: adminHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      termsAccepted: true,
      isActive: true,
      phone: '09123456789',
      address: 'GC Rice & Trading Store',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Admin inserted');

    // Insert Staff 1
    await usersCollection.insertOne({
      email: 'staff@agrivend.com',
      password: staffHash,
      firstName: 'John',
      lastName: 'Doe',
      role: 'staff',
      termsAccepted: true,
      isActive: true,
      phone: '09123456788',
      address: 'Staff Office',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Staff inserted: staff@agrivend.com');

    // Insert Staff 2
    await usersCollection.insertOne({
      email: 'maria@agrivend.com',
      password: staffHash,
      firstName: 'Maria',
      lastName: 'Santos',
      role: 'staff',
      termsAccepted: true,
      isActive: true,
      phone: '09123456787',
      address: 'Staff Office 2',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Staff inserted: maria@agrivend.com');

    // VERIFY ALL PASSWORDS
    console.log('\n🔍 VERIFYING PASSWORDS:');
    
    const admin = await usersCollection.findOne({ email: 'admin@agrivend.com' });
    const adminValid = await bcrypt.compare('admin123', admin.password);
    console.log(`   admin@agrivend.com / admin123 : ${adminValid ? '✅ OK' : '❌ FAILED'}`);

    const staff = await usersCollection.findOne({ email: 'staff@agrivend.com' });
    const staffValid = await bcrypt.compare('staff123', staff.password);
    console.log(`   staff@agrivend.com / staff123 : ${staffValid ? '✅ OK' : '❌ FAILED'}`);

    const maria = await usersCollection.findOne({ email: 'maria@agrivend.com' });
    const mariaValid = await bcrypt.compare('staff123', maria.password);
    console.log(`   maria@agrivend.com / staff123 : ${mariaValid ? '✅ OK' : '❌ FAILED'}`);

    console.log('\n✅ Database is READY!\n');
    console.log('📝 LOGIN CREDENTIALS:');
    console.log('   Admin: admin@agrivend.com / admin123');
    console.log('   Staff: staff@agrivend.com / staff123');
    console.log('   Staff: maria@agrivend.com / staff123\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

ultimateFix();