import express from 'express';
import Transaction from '../models/Transaction.js';
import Machine from '../models/Machine.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================
// DIRECT DATABASE FETCH - NO deviceId NEEDED
// ============================================

// MAIN ENDPOINT - Get machine data directly from database
router.get('/latest', async (req, res) => {
  try {
    // Get the machine with data (find one that has weight > 0 or just the first)
    let machine = await Machine.findOne({ "storage1.currentWeight": { $gt: 0 } });
    
    if (!machine) {
      machine = await Machine.findOne({});
    }
    
    if (!machine) {
      console.log('No machine found in database');
      return res.json({
        success: true,
        storage1: { currentWeight: 0, percentage: 0, status: 'Empty', pricePerKg: 52 },
        storage2: { currentWeight: 0, percentage: 0, status: 'Empty', pricePerKg: 65 },
        batteryPercentage: 100,
        doorStatus: 'Closed',
        temperature: 25,
        totalStock: 0
      });
    }
    
    console.log('✅ Returning data from database:');
    console.log('   Sinandomeng weight:', machine.storage1?.currentWeight);
    console.log('   Dinorado weight:', machine.storage2?.currentWeight);
    
    res.json({
      success: true,
      storage1: {
        currentWeight: machine.storage1?.currentWeight || 0,
        percentage: machine.storage1?.percentage || 0,
        status: machine.storage1?.status || 'Empty',
        pricePerKg: machine.storage1?.pricePerKg || 52
      },
      storage2: {
        currentWeight: machine.storage2?.currentWeight || 0,
        percentage: machine.storage2?.percentage || 0,
        status: machine.storage2?.status || 'Empty',
        pricePerKg: machine.storage2?.pricePerKg || 65
      },
      batteryPercentage: machine.battery?.percentage || 100,
      doorStatus: machine.machineStatus?.doorStatus || 'Closed',
      temperature: machine.machineStatus?.temperature || 25,
      totalStock: (machine.storage1?.currentWeight || 0) + (machine.storage2?.currentWeight || 0)
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ESP32 updates data - FINDS AND UPDATES YOUR EXISTING MACHINE
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

    // Find ANY machine document (the one with your data)
    let machine = await Machine.findOne({});
    
    if (!machine) {
      // Create new if none exists
      machine = new Machine();
      console.log('Created new machine document');
    }
    
    // Update weights
    if (loadCellLeft !== undefined) {
      machine.storage1.currentWeight = loadCellLeft;
      machine.storage1.percentage = (loadCellLeft / 20) * 100;
      machine.storage1.status = loadCellLeft <= 0.05 ? 'Empty' : loadCellLeft < 5 ? 'Low' : 'Normal';
    }
    
    if (loadCellRight !== undefined) {
      machine.storage2.currentWeight = loadCellRight;
      machine.storage2.percentage = (loadCellRight / 20) * 100;
      machine.storage2.status = loadCellRight <= 0.05 ? 'Empty' : loadCellRight < 5 ? 'Low' : 'Normal';
    }
    
    // Update battery
    if (batteryPercentage !== undefined) {
      machine.battery.percentage = batteryPercentage;
    }
    
    // Update door status
    if (doorStatus) {
      machine.machineStatus.doorStatus = doorStatus === 'OPEN' ? 'Open' : 'Closed';
    }
    
    // Update temperature
    if (temperature !== undefined) {
      machine.machineStatus.temperature = temperature;
    }
    
    machine.machineStatus.lastUpdate = new Date();
    machine.machineStatus.isOnline = true;
    
    await machine.save();
    
    console.log(`✅ Updated machine!`);
    console.log(`   Sinandomeng: ${machine.storage1.currentWeight}kg`);
    console.log(`   Dinorado: ${machine.storage2.currentWeight}kg`);
    
    res.json({ success: true, message: 'Machine updated' });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCT PRICE MANAGEMENT (PRESERVED)
// ============================================

// Get product prices
router.get('/prices', async (req, res) => {
  try {
    // First try to get from Products table
    let dinoradoProduct = await Product.findOne({ name: 'DINORADO' });
    let sinandomengProduct = await Product.findOne({ name: 'SINANDOMENG' });
    
    // If not found in Products table, get from Machine table
    if (!dinoradoProduct || !sinandomengProduct) {
      const machine = await Machine.findOne({});
      if (machine) {
        return res.json({
          success: true,
          prices: {
            dinorado: machine.storage2?.pricePerKg || 65,
            sinandomeng: machine.storage1?.pricePerKg || 52
          }
        });
      }
    }
    
    res.json({
      success: true,
      prices: {
        dinorado: dinoradoProduct ? dinoradoProduct.price : 65,
        sinandomeng: sinandomengProduct ? sinandomengProduct.price : 52
      }
    });
  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    res.json({
      success: true,
      prices: { dinorado: 65, sinandomeng: 52 }
    });
  }
});

// Update product prices (from website)
router.post('/prices/update', async (req, res) => {
  try {
    const { dinoradoPrice, sinandomengPrice } = req.body;
    
    // Update prices in Products table
    await Product.findOneAndUpdate(
      { name: 'DINORADO' },
      { price: dinoradoPrice || 65 },
      { upsert: true, new: true }
    );
    
    await Product.findOneAndUpdate(
      { name: 'SINANDOMENG' },
      { price: sinandomengPrice || 52 },
      { upsert: true, new: true }
    );
    
    // Also update prices in Machine table
    const machine = await Machine.findOne({});
    if (machine) {
      machine.storage1.pricePerKg = sinandomengPrice || 52;
      machine.storage2.pricePerKg = dinoradoPrice || 65;
      await machine.save();
    }
    
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

// Get current prices (for website display)
router.get('/prices/current', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
    res.json({
      success: true,
      prices: {
        dinorado: machine?.storage2?.pricePerKg || 65,
        sinandomeng: machine?.storage1?.pricePerKg || 52
      }
    });
  } catch (error) {
    console.error('❌ Error fetching current prices:', error);
    res.json({
      success: true,
      prices: { dinorado: 65, sinandomeng: 52 }
    });
  }
});

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// Get latest machine data for public dashboard
router.get('/public/latest', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
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
        totalStock: (machine.storage1.currentWeight || 0) + (machine.storage2.currentWeight || 0),
        batteryPercentage: machine.battery.percentage,
        doorStatus: machine.machineStatus.doorStatus,
        machineStatus: machine.machineStatus.isOnline ? 'ONLINE' : 'OFFLINE',
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
    const machine = await Machine.findOne({});
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
    const machine = await Machine.findOne({});
    
    res.json({
      success: true,
      data: {
        totalStock: machine ? (machine.storage1.currentWeight + machine.storage2.currentWeight) : 0,
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
// TRANSACTIONS
// ============================================

// Transaction confirm from ESP32
router.post('/transaction/confirm', async (req, res) => {
  console.log('📝 ESP32 Transaction received:', req.body);
  
  try {
    const { transactionId, riceType, quantityKg, amountPaid, status } = req.body;
    
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
    const machine = await Machine.findOne({});
    if (machine) {
      machine.machineStatus.transactionCount = (machine.machineStatus.transactionCount || 0) + 1;
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

// Get transactions history
router.get('/transactions', async (req, res) => {
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

// ============================================
// SECURITY & DEBUG
// ============================================

// Security alert from ESP32
router.post('/security/alert', async (req, res) => {
  console.log('🚨 Security alert:', req.body.alertType);
  
  const io = req.app.get('io');
  if (io) io.emit('security_alert', req.body);
  
  res.json({ success: true });
});

// Debug endpoint - Check database contents
router.get('/debug', async (req, res) => {
  try {
    const allMachines = await Machine.find({});
    
    console.log('=== DATABASE CONTENTS ===');
    allMachines.forEach((m, i) => {
      console.log(`Machine ${i + 1}:`);
      console.log(`  _id: ${m._id}`);
      console.log(`  Sinandomeng: ${m.storage1?.currentWeight}kg`);
      console.log(`  Dinorado: ${m.storage2?.currentWeight}kg`);
      console.log(`  Sinandomeng Price: PHP ${m.storage1?.pricePerKg}`);
      console.log(`  Dinorado Price: PHP ${m.storage2?.pricePerKg}`);
    });
    
    res.json({
      totalMachines: allMachines.length,
      machines: allMachines.map(m => ({
        id: m._id,
        sinandomeng: { weight: m.storage1?.currentWeight, price: m.storage1?.pricePerKg },
        dinorado: { weight: m.storage2?.currentWeight, price: m.storage2?.pricePerKg }
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Stock quick view
router.get('/stock', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
    if (!machine) {
      return res.json({
        success: true,
        premium: { kg: 0, status: 'NO_DATA', percentage: 0 },
        regular: { kg: 0, status: 'NO_DATA', percentage: 0 },
        total: 0
      });
    }
    
    res.json({
      success: true,
      premium: {
        kg: machine.storage2?.currentWeight || 0,
        status: machine.storage2?.status || 'Empty',
        percentage: machine.storage2?.percentage || 0
      },
      regular: {
        kg: machine.storage1?.currentWeight || 0,
        status: machine.storage1?.status || 'Empty',
        percentage: machine.storage1?.percentage || 0
      },
      total: (machine.storage1?.currentWeight || 0) + (machine.storage2?.currentWeight || 0)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Machine status
router.get('/machine/status', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    res.json({ success: true, data: machine || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sensors history
router.get('/sensors/history', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    res.json({ success: true, data: machine || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// TEST endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'ESP32 Routes working with ALL features!',
    endpoints: [
      'GET /api/esp32/latest - Get machine data from database',
      'POST /api/esp32/sensors/update - Update machine weights',
      'GET /api/esp32/prices - Get product prices',
      'POST /api/esp32/prices/update - Update product prices',
      'GET /api/esp32/prices/current - Get current prices',
      'POST /api/esp32/transaction/confirm - Send transaction',
      'GET /api/esp32/transactions - Get transactions',
      'GET /api/esp32/public/latest - Public dashboard',
      'GET /api/esp32/public/storage/:id - Public storage view',
      'GET /api/esp32/public/summary - Public summary',
      'GET /api/esp32/debug - Debug database contents',
      'GET /api/esp32/stock - Quick stock view'
    ]
  });
});

export default router;