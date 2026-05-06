import express from 'express';
import Transaction from '../models/Transaction.js';
import Machine from '../models/Machine.js';
import Product from '../models/Product.js';

const router = express.Router();

// ============================================
// HELPER FUNCTION - Get or create machine
// ============================================
async function getOrCreateMachine(deviceId) {
  let machine = await Machine.findOne({ deviceId: deviceId });
  if (!machine) {
    machine = new Machine({ deviceId: deviceId });
    await machine.save();
    console.log(`✅ Created new machine record for ${deviceId}`);
  }
  return machine;
}

// ============================================
// PUBLIC ENDPOINTS (No authentication required)
// ============================================

// Get latest machine data for public dashboard
router.get('/public/latest', async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine) {
      return res.json({
        success: true,
        data: {
          storage1: { currentWeight: 0, percentage: 0, status: 'NO_DATA' },
          storage2: { currentWeight: 0, percentage: 0, status: 'NO_DATA' },
          totalStock: 0,
          batteryPercentage: 100,
          doorStatus: 'Closed',
          machineStatus: 'ACTIVE',
          lastUpdate: null
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        storage1: {
          currentWeight: machine.storage1.currentWeight,
          percentage: machine.storage1.percentage,
          status: machine.storage1.status
        },
        storage2: {
          currentWeight: machine.storage2.currentWeight,
          percentage: machine.storage2.percentage,
          status: machine.storage2.status
        },
        totalStock: machine.totalStock,
        batteryPercentage: machine.battery.percentage,
        doorStatus: machine.machineStatus.doorStatus,
        machineStatus: machine.machineStatus.isOnline ? 'ONLINE' : 'OFFLINE',
        loadCellStatus: machine.machineStatus.loadCellStatus,
        lastUpdate: machine.machineStatus.lastUpdate
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific storage data
router.get('/public/storage/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    const maxLevel = 20;
    
    if (!machine) {
      return res.json({
        success: true,
        data: { level: 0, maxLevel, percentage: 0, fillLevel: '0%', status: 'OK', remainingKg: 0 }
      });
    }
    
    const storage = id === '1' ? machine.storage1 : machine.storage2;
    
    res.json({
      success: true,
      data: {
        level: storage.currentWeight,
        maxLevel: storage.maxCapacity,
        percentage: storage.percentage,
        fillLevel: storage.percentage.toFixed(1) + '%',
        status: storage.status,
        remainingKg: storage.currentWeight
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get machine summary
router.get('/public/summary', async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        totalStock: machine ? machine.totalStock : 0,
        batteryPercentage: machine?.battery.percentage || 100,
        doorStatus: machine?.machineStatus.doorStatus || 'Closed',
        machineStatus: machine?.machineStatus.isOnline ? 'ONLINE' : 'OFFLINE'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ESP32 ENDPOINTS (No authentication)
// ============================================

router.post('/sensors/update', async (req, res) => {
  console.log('📡 ESP32 Data received');
  console.log('📦 Body:', req.body);
  
  try {
    const {
      loadCellLeft,    // Sinandomeng
      loadCellRight,   // Dinorado
      batteryPercentage,
      doorStatus,
      temperature
    } = req.body;

    // FIND THE EXISTING DOCUMENT BY ITS _id (NO deviceId)
    // Use the actual _id from your database
    const machine = await Machine.findById("69fa1ca4e581a073cd09c802");
    
    if (!machine) {
      console.log('❌ Machine document not found!');
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    // UPDATE THE WEIGHTS
    machine.storage1.currentWeight = loadCellLeft || 0;
    machine.storage2.currentWeight = loadCellRight || 0;
    machine.storage1.lastUpdated = new Date();
    machine.storage2.lastUpdated = new Date();
    
    // Calculate percentages
    const maxCapacity = 20;
    machine.storage1.percentage = (machine.storage1.currentWeight / maxCapacity) * 100;
    machine.storage2.percentage = (machine.storage2.currentWeight / maxCapacity) * 100;
    
    // Update status
    if (machine.storage1.currentWeight <= 0.05) {
      machine.storage1.status = "Empty";
    } else if (machine.storage1.currentWeight < 5) {
      machine.storage1.status = "Low";
    } else {
      machine.storage1.status = "Normal";
    }
    
    if (machine.storage2.currentWeight <= 0.05) {
      machine.storage2.status = "Empty";
    } else if (machine.storage2.currentWeight < 5) {
      machine.storage2.status = "Low";
    } else {
      machine.storage2.status = "Normal";
    }
    
    // Update battery
    if (batteryPercentage) {
      machine.battery.percentage = batteryPercentage;
    }
    
    // Update door status
    if (doorStatus) {
      machine.machineStatus.doorStatus = doorStatus === 'OPEN' ? 'Open' : 'Closed';
    }
    
    // Update temperature
    if (temperature) {
      machine.machineStatus.temperature = temperature;
    }
    
    machine.machineStatus.lastUpdate = new Date();
    machine.machineStatus.isOnline = true;
    
    // SAVE TO DATABASE
    await machine.save();
    
    console.log(`✅ Updated machine document!`);
    console.log(`   Sinandomeng: ${machine.storage1.currentWeight}kg`);
    console.log(`   Dinorado: ${machine.storage2.currentWeight}kg`);
    
    res.json({ success: true, message: 'Machine updated' });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CHANGE FROM: router.get('/latest/:deviceId', ...)
// TO:
router.get('/latest', async (req, res) => {
  try {
    // Get the first (and only) machine document
    const machine = await Machine.findOne(); // No filter, just get the document
    
    if (!machine) {
      return res.json({
        success: true,
        storage1: { currentWeight: 0, percentage: 0, status: 'Empty' },
        storage2: { currentWeight: 0, percentage: 0, status: 'Empty' }
      });
    }
    
    res.json({
      success: true,
      storage1: {
        currentWeight: machine.storage1.currentWeight,
        percentage: machine.storage1.percentage,
        status: machine.storage1.status,
        pricePerKg: machine.storage1.pricePerKg
      },
      storage2: {
        currentWeight: machine.storage2.currentWeight,
        percentage: machine.storage2.percentage,
        status: machine.storage2.status,
        pricePerKg: machine.storage2.pricePerKg
      },
      batteryPercentage: machine.battery.percentage,
      doorStatus: machine.machineStatus.doorStatus,
      temperature: machine.machineStatus.temperature,
      totalStock: machine.storage1.currentWeight + machine.storage2.currentWeight
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ENDPOINT: Get current stock quick view =====
router.get('/stock/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const machine = await Machine.findOne({ deviceId: deviceId || 'AGRIVEND_001' });
    
    if (!machine) {
      return res.json({
        success: true,
        deviceId: deviceId || 'AGRIVEND_001',
        premium: { kg: 0, status: 'NO_DATA', percentage: 0 },
        regular: { kg: 0, status: 'NO_DATA', percentage: 0 },
        total: 0,
        loadCellStatus: 'NO_DATA'
      });
    }
    
    res.json({
      success: true,
      deviceId: machine.deviceId,
      premium: {
        kg: machine.storage2.currentWeight,  // Dinorado = storage2
        status: machine.storage2.status,
        percentage: machine.storage2.percentage
      },
      regular: {
        kg: machine.storage1.currentWeight,  // Sinandomeng = storage1
        status: machine.storage1.status,
        percentage: machine.storage1.percentage
      },
      total: machine.totalStock,
      loadCellStatus: machine.machineStatus.loadCellStatus,
      lastUpdate: machine.machineStatus.lastUpdate
    });
    
  } catch (error) {
    console.error('❌ Error fetching stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ENDPOINT: Get product prices =====
router.get('/prices', async (req, res) => {
  try {
    // Get prices from Products table
    const dinoradoProduct = await Product.findOne({ name: 'DINORADO' });
    const sinandomengProduct = await Product.findOne({ name: 'SINANDOMENG' });
    
    res.json({
      success: true,
      prices: {
        dinorado: dinoradoProduct ? dinoradoProduct.price : 65.0,
        sinandomeng: sinandomengProduct ? sinandomengProduct.price : 52.0
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    res.json({
      success: true,
      prices: {
        dinorado: 65.0,
        sinandomeng: 52.0
      }
    });
  }
});

// ===== ENDPOINT: Update product prices =====
router.post('/prices/update', async (req, res) => {
  try {
    const { dinoradoPrice, sinandomengPrice } = req.body;
    
    // Update prices in Products table
    await Product.findOneAndUpdate(
      { name: 'DINORADO' },
      { price: dinoradoPrice || 65.0 },
      { upsert: true, new: true }
    );
    
    await Product.findOneAndUpdate(
      { name: 'SINANDOMENG' },
      { price: sinandomengPrice || 52.0 },
      { upsert: true, new: true }
    );
    
    console.log(`💰 Prices updated - Dinorado: PHP ${dinoradoPrice}, Sinandomeng: PHP ${sinandomengPrice}`);
    
    res.json({
      success: true,
      message: 'Prices updated successfully',
      prices: {
        dinorado: dinoradoPrice,
        sinandomeng: sinandomengPrice
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ENDPOINT: Get current prices =====
router.get('/prices/current', async (req, res) => {
  try {
    const dinoradoProduct = await Product.findOne({ name: 'DINORADO' });
    const sinandomengProduct = await Product.findOne({ name: 'SINANDOMENG' });
    
    res.json({
      success: true,
      prices: {
        dinorado: dinoradoProduct ? dinoradoProduct.price : 65.0,
        sinandomeng: sinandomengProduct ? sinandomengProduct.price : 52.0
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching current prices:', error);
    res.json({
      success: true,
      prices: {
        dinorado: 65.0,
        sinandomeng: 52.0
      }
    });
  }
});

// ===== Transaction confirm from ESP32 =====
router.post('/transaction/confirm', async (req, res) => {
  console.log('📝 ESP32 Transaction received:', req.body);
  
  try {
    const { transactionId, riceType, quantityKg, amountPaid, status, remainingStockPremium, remainingStockRegular } = req.body;
    
    if (!riceType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rice type is required' 
      });
    }
    
    if (!quantityKg || !amountPaid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity and amount are required' 
      });
    }
    
    let productName;
    let pricePerKg;
    
    if (riceType === "DINORADO" || riceType === "Dinorado Rice") {
      productName = "Dinorado Rice";
      pricePerKg = 65.0;
    } else if (riceType === "SINANDOMENG" || riceType === "Sinandomeng Rice") {
      productName = "Sinandomeng Rice";
      pricePerKg = 52.0;
    } else {
      productName = "Sinandomeng Rice";
      pricePerKg = 52.0;
    }
    
    const existingTransaction = await Transaction.findOne({ transactionId: transactionId });
    if (existingTransaction) {
      console.log(`⚠️ Transaction ${transactionId} already exists, skipping...`);
      return res.json({ 
        success: true, 
        message: 'Transaction already exists',
        alreadyExists: true
      });
    }
    
    const transaction = new Transaction({
      transactionId: transactionId || `TXN-${Date.now()}`,
      productName: productName,
      quantityKg: parseFloat(quantityKg),
      pricePerKg: pricePerKg,
      amountPaid: parseFloat(amountPaid),
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      source: 'machine',
      notes: `Auto-recorded by vending machine.`
    });
    
    await transaction.save();
    
    console.log(`✅ Transaction saved: ${transaction.transactionId}`);
    console.log(`   Product: ${productName}, ${quantityKg}kg, PHP ${amountPaid}`);
    
    // Update transaction count in machine
    const machine = await Machine.findOne({ deviceId: 'AGRIVEND_001' });
    if (machine) {
      machine.machineStatus.transactionCount += 1;
      await machine.save();
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('new_transaction', {
        transactionId: transaction.transactionId,
        productName: transaction.productName,
        quantityKg: transaction.quantityKg,
        amountPaid: transaction.amountPaid,
        source: 'machine'
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Transaction recorded successfully'
    });
    
  } catch (error) {
    console.error('❌ Transaction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET transactions history =====
router.get('/transactions/:deviceId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const transactions = await Transaction.find({ source: 'machine' })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      count: transactions.length,
      transactions: transactions
    });
    
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Security alert from ESP32 =====
router.post('/security/alert', async (req, res) => {
  console.log('🚨 Security alert:', req.body.alertType);
  
  const io = req.app.get('io');
  if (io) io.emit('security_alert', req.body);
  
  res.json({ success: true });
});

// ===== TEST endpoint =====
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'ESP32 Routes are working with MACHINE table!',
    endpoints: [
      'POST /api/esp32/sensors/update - Update Machine table',
      'GET /api/esp32/latest/:deviceId - Get latest machine data',
      'GET /api/esp32/stock/:deviceId - Quick stock view',
      'POST /api/esp32/transaction/confirm - Send transaction',
      'GET /api/esp32/transactions/:deviceId - Get transactions',
      'GET /api/esp32/prices - Get product prices',
      'POST /api/esp32/prices/update - Update product prices',
      'GET /api/esp32/prices/current - Get current prices',
      'GET /api/esp32/public/latest - Public dashboard',
      'GET /api/esp32/public/storage/:id - Public storage view',
      'GET /api/esp32/public/summary - Public summary'
    ]
  });
});

// ============================================
// ADMIN PROTECTED ENDPOINTS
// ============================================

router.get('/machine/status', async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    res.json({ success: true, data: machine || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sensors/history', async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    res.json({ success: true, data: machine || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;