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
        storage1: { currentWeight: 0, percentage: 0, status: 'Empty', pricePerKg: 135, name: 'Pedigree' },
        storage2: { currentWeight: 0, percentage: 0, status: 'Empty', pricePerKg: 165, name: 'AOZI' },
        batteryPercentage: 100,
        doorStatus: 'Closed',
        temperature: 25,
        totalStock: 0
      });
    }
    
    console.log('✅ Returning data from database:');
    console.log('   Pedigree weight:', machine.storage1?.currentWeight);
    console.log('   AOZI weight:', machine.storage2?.currentWeight);
    
    res.json({
      success: true,
      storage1: {
        currentWeight: machine.storage1?.currentWeight || 0,
        percentage: machine.storage1?.percentage || 0,
        status: machine.storage1?.status || 'Empty',
        pricePerKg: machine.storage1?.pricePerKg || 135,
        name: machine.storage1?.name || 'Pedigree'
      },
      storage2: {
        currentWeight: machine.storage2?.currentWeight || 0,
        percentage: machine.storage2?.percentage || 0,
        status: machine.storage2?.status || 'Empty',
        pricePerKg: machine.storage2?.pricePerKg || 165,
        name: machine.storage2?.name || 'AOZI'
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
      loadCellLeft,    // Pedigree (Left)
      loadCellRight,   // AOZI (Right)
      batteryPercentage,
      doorStatus,
      temperature,
      machineState,
      transactionCount,
      machineStatus
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
      machine.battery.status = batteryPercentage > 70 ? 'Good' : batteryPercentage > 30 ? 'Warning' : 'Critical';
    }
    
    // Update door status
    if (doorStatus) {
      machine.machineStatus.doorStatus = doorStatus === 'OPEN' ? 'Open' : 'Closed';
    }
    
    // Update temperature
    if (temperature !== undefined) {
      machine.machineStatus.temperature = temperature;
    }
    
    // Update transaction count
    if (transactionCount !== undefined) {
      machine.machineStatus.transactionCount = transactionCount;
    }
    
    machine.machineStatus.lastUpdate = new Date();
    machine.machineStatus.isOnline = true;
    
    await machine.save();
    
    console.log(`✅ Updated machine!`);
    console.log(`   Pedigree: ${machine.storage1.currentWeight}kg`);
    console.log(`   AOZI: ${machine.storage2.currentWeight}kg`);
    
    res.json({ success: true, message: 'Machine updated' });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCT PRICE MANAGEMENT - UPDATED FOR AOZI & PEDIGREE
// ============================================

// Get product prices AND names (for ESP32)
router.get('/prices', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
    if (!machine) {
      return res.json({
        success: true,
        prices: {
          aozi: 165,
          pedigree: 135
        },
        products: {
          aozi_name: 'AOZI',
          pedigree_name: 'Pedigree'
        }
      });
    }
    
    res.json({
      success: true,
      prices: {
        aozi: machine.storage2?.pricePerKg || 165,
        pedigree: machine.storage1?.pricePerKg || 135
      },
      products: {
        aozi_name: machine.storage2?.name || 'AOZI',
        pedigree_name: machine.storage1?.name || 'Pedigree'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    res.json({
      success: true,
      prices: { aozi: 165, pedigree: 135 },
      products: { aozi_name: 'AOZI', pedigree_name: 'Pedigree' }
    });
  }
});

// Update product prices (from website)
router.post('/prices/update', async (req, res) => {
  try {
    const { aoziPrice, pedigreePrice } = req.body;
    
    // Update machine table
    const machine = await Machine.findOne({});
    if (machine) {
      if (aoziPrice !== undefined) machine.storage2.pricePerKg = aoziPrice;
      if (pedigreePrice !== undefined) machine.storage1.pricePerKg = pedigreePrice;
      await machine.save();
    }
    
    console.log(`💰 Prices updated - AOZI: PHP ${aoziPrice}, Pedigree: PHP ${pedigreePrice}`);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('price_updated', {
        aozi: aoziPrice,
        pedigree: pedigreePrice
      });
      console.log('📡 Price update sent to ESP32 via WebSocket');
    }
    
    res.json({ success: true, message: 'Prices updated successfully' });
    
  } catch (error) {
    console.error('❌ Error updating prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current prices (for ESP32) - UPDATED FOR AOZI & PEDIGREE
router.get('/prices/current', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
    res.json({
      success: true,
      prices: {
        aozi: machine?.storage2?.pricePerKg || 165,
        pedigree: machine?.storage1?.pricePerKg || 135
      },
      products: {
        aozi_name: machine?.storage2?.name || "AOZI",
        pedigree_name: machine?.storage1?.name || "Pedigree"
      }
    });
  } catch (error) {
    console.error('❌ Error fetching current prices:', error);
    res.json({
      success: true,
      prices: { aozi: 165, pedigree: 135 },
      products: { aozi_name: "AOZI", pedigree_name: "Pedigree" }
    });
  }
});

// Force ESP32 to fetch latest prices
router.post('/prices/force-update', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
    res.json({
      success: true,
      prices: {
        aozi: machine?.storage2?.pricePerKg || 165,
        pedigree: machine?.storage1?.pricePerKg || 135
      },
      products: {
        aozi_name: machine?.storage2?.name || "AOZI",
        pedigree_name: machine?.storage1?.name || "Pedigree"
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UPDATE PRODUCT NAME AND PRICE (from website)
// ============================================
router.put('/product/update/:storageId', async (req, res) => {
  try {
    const { storageId } = req.params;
    const { name, pricePerKg } = req.body;
    
    console.log(`📝 Updating Storage ${storageId}: Name="${name}", Price=${pricePerKg}`);
    
    // Find the machine
    let machine = await Machine.findOne({});
    
    if (!machine) {
      machine = new Machine();
    }
    
    // Update the correct storage
    if (storageId === '1') {
      if (name) machine.storage1.name = name;
      if (pricePerKg) machine.storage1.pricePerKg = pricePerKg;
      console.log(`✅ Storage 1 (Pedigree) updated: ${name} @ PHP ${pricePerKg}/kg`);
    } else if (storageId === '2') {
      if (name) machine.storage2.name = name;
      if (pricePerKg) machine.storage2.pricePerKg = pricePerKg;
      console.log(`✅ Storage 2 (AOZI) updated: ${name} @ PHP ${pricePerKg}/kg`);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid storage ID' });
    }
    
    await machine.save();
    
    console.log(`✅ Product updated: ${name} @ PHP ${pricePerKg}/kg`);
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('product_updated', {
        storageId: storageId,
        name: name,
        pricePerKg: pricePerKg
      });
      console.log('📡 Product update sent to all connected clients');
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: storageId === '1' ? machine.storage1 : machine.storage2
    });
    
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET PRODUCTS (names and prices) for website
// ============================================
router.get('/products/current', async (req, res) => {
  try {
    const machine = await Machine.findOne({});
    
    if (!machine) {
      return res.json({
        success: true,
        storage1: { name: 'Pedigree', pricePerKg: 135 },
        storage2: { name: 'AOZI', pricePerKg: 165 }
      });
    }
    
    res.json({
      success: true,
      storage1: {
        name: machine.storage1.name || 'Pedigree',
        pricePerKg: machine.storage1.pricePerKg || 135
      },
      storage2: {
        name: machine.storage2.name || 'AOZI',
        pricePerKg: machine.storage2.pricePerKg || 165
      }
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TRANSACTIONS - UPDATED FOR AOZI & PEDIGREE
// ============================================

// Transaction confirm from ESP32
router.post('/transaction/confirm', async (req, res) => {
  console.log('📝 ESP32 Transaction received:', req.body);
  
  try {
    // Support both field names (riceType from old, productType from new)
    let productType = req.body.productType || req.body.riceType;
    
    if (!productType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product type is required' 
      });
    }
    
    const { transactionId, quantityKg, amountPaid, status } = req.body;
    
    if (!quantityKg || !amountPaid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity and amount are required' 
      });
    }
    
    let productName;
    let pricePerKg;
    
    // Handle AOZI and PEDIGREE product names
    if (productType === "AOZI" || productType === "AOZI Dog Food") {
      productName = "AOZI Dog Food";
      pricePerKg = 165.0;
    } else if (productType === "PEDIGREE" || productType === "Pedigree Dog Food") {
      productName = "Pedigree Dog Food";
      pricePerKg = 135.0;
    } 
    // Fallback for old product names
    else if (productType === "DINORADO" || productType === "Dinorado Rice") {
      productName = "Dinorado Rice";
      pricePerKg = 65.0;
    } else if (productType === "SINANDOMENG" || productType === "Sinandomeng Rice") {
      productName = "Sinandomeng Rice";
      pricePerKg = 52.0;
    } else {
      productName = productType;
      pricePerKg = 135.0;
    }
    
    // Check for duplicate transaction
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
          storage1: { currentWeight: 0, percentage: 0, status: 'NO_DATA', name: 'Pedigree' },
          storage2: { currentWeight: 0, percentage: 0, status: 'NO_DATA', name: 'AOZI' },
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
          status: machine.storage1.status,
          name: machine.storage1.name || 'Pedigree'
        },
        storage2: {
          currentWeight: machine.storage2.currentWeight,
          percentage: machine.storage2.percentage,
          status: machine.storage2.status,
          name: machine.storage2.name || 'AOZI'
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
        data: { level: 0, maxLevel, percentage: 0, fillLevel: '0%', status: 'OK', remainingKg: 0, name: id === '1' ? 'Pedigree' : 'AOZI' }
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
        remainingKg: storage.currentWeight,
        name: storage.name || (id === '1' ? 'Pedigree' : 'AOZI')
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
      console.log(`  Pedigree: ${m.storage1?.currentWeight}kg @ PHP ${m.storage1?.pricePerKg}`);
      console.log(`  AOZI: ${m.storage2?.currentWeight}kg @ PHP ${m.storage2?.pricePerKg}`);
    });
    
    res.json({
      totalMachines: allMachines.length,
      machines: allMachines.map(m => ({
        id: m._id,
        pedigree: { weight: m.storage1?.currentWeight, price: m.storage1?.pricePerKg, name: m.storage1?.name },
        aozi: { weight: m.storage2?.currentWeight, price: m.storage2?.pricePerKg, name: m.storage2?.name }
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
        aozi: { kg: 0, status: 'NO_DATA', percentage: 0 },
        pedigree: { kg: 0, status: 'NO_DATA', percentage: 0 },
        total: 0
      });
    }
    
    res.json({
      success: true,
      aozi: {
        kg: machine.storage2?.currentWeight || 0,
        status: machine.storage2?.status || 'Empty',
        percentage: machine.storage2?.percentage || 0,
        name: machine.storage2?.name || 'AOZI'
      },
      pedigree: {
        kg: machine.storage1?.currentWeight || 0,
        status: machine.storage1?.status || 'Empty',
        percentage: machine.storage1?.percentage || 0,
        name: machine.storage1?.name || 'Pedigree'
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
    message: 'ESP32 Routes working with AOZI & PEDIGREE!',
    endpoints: [
      'GET /api/esp32/latest - Get machine data from database',
      'POST /api/esp32/sensors/update - Update machine weights',
      'GET /api/esp32/prices - Get product prices (AOZI/PEDIGREE)',
      'POST /api/esp32/prices/update - Update product prices',
      'GET /api/esp32/prices/current - Get current prices for ESP32',
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