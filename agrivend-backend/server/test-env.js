import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from parent directory
const envPath = path.resolve(__dirname, '../.env');
console.log('🔍 Looking for .env at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.log('❌ Error loading .env:', result.error.message);
  } else {
    console.log('✅ .env loaded successfully');
    console.log('\n📋 Environment variables loaded:');
    console.log('   PORT:', process.env.PORT ? '✅' : '❌');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅' : '❌');
    console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅' : '❌');
    console.log('   FRONTEND_URL:', process.env.FRONTEND_URL ? '✅' : '❌');
  }
} else {
  console.log('❌ .env file NOT found');
}