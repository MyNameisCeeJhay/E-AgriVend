import express from 'express';
import Transaction from '../models/Transaction.js';
import Machine from '../models/Machine.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get or create machine
async function getOrCreateMachine() {
  let machine = await Machine.findOne({});
  if (!machine) {
    machine = new Machine({
      storage1: { name: 'PEDIGREE', currentWeight: 0, maxCapacity: 20, pricePerKg: 135 },
      storage2: { name: 'AOZI', currentWeight: 0, maxCapacity: 20, pricePerKg: 165 },
      battery: { percentage: 100, status: 'Good', voltage: 12.6 },
      machineStatus: { doorStatus: 'Closed', isOnline: false, transactionCount: 0 }
    });
    await machine.save();
    console.log('📦 Created new machine document');
  }
  return machine;
}

// Emit socket event if available
function emitSocketEvent(req, event, data) {
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit(event, data);
    }
  } catch (error) {
    // Socket not available, ignore
  }
}

// ============================================
// TEST ENDPOINT - For ESP32 connection check
// ============================================

router.get('/test', (req, res) => {
  console.log('📡 ESP32 Test endpoint hit');
  res.json({
    success: true,
    message: 'AGRIVEND ESP32 Routes Working!',
    deviceId: 'AGRIVEND_001',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/esp32/test - Connection test',
      'POST /api/esp32/sensors/update - Update sensor data',
      'GET /api/esp32/prices/current - Get current prices',
      'GET /api/esp32/products/current - Get product names',
      'POST /api/esp32/transaction/confirm - Confirm transaction',
      'GET /api/esp32/transactions - Get transactions',
      'POST /api/esp32/cash/update - Update cash data',
      'POST /api/esp32/cash/collect - Collect cash',
      'GET /api/esp32/calibration/command/pending - Get pending calibration',
      'POST /api/esp32/security/alert - Security alerts'
    ]
  });
});

// ============================================
// MAIN ENDPOINT - Get machine data
// ============================================

router.get('/latest', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    console.log('📊 Returning machine data:');
    console.log(`   PEDIGREE: ${machine.storage1?.currentWeight || 0}kg @ PHP ${machine.storage1?.pricePerKg || 135}`);
    console.log(`   AOZI: ${machine.storage2?.currentWeight || 0}kg @ PHP ${machine.storage2?.pricePerKg || 165}`);
    
    res.json({
      success: true,
      storage1: {
        currentWeight: machine.storage1?.currentWeight || 0,
        percentage: machine.storage1?.percentage || 0,
        status: machine.storage1?.status || 'Empty',
        pricePerKg: machine.storage1?.pricePerKg || 135,
        name: machine.storage1?.name || 'PEDIGREE',
        maxCapacity: machine.storage1?.maxCapacity || 20
      },
      storage2: {
        currentWeight: machine.storage2?.currentWeight || 0,
        percentage: machine.storage2?.percentage || 0,
        status: machine.storage2?.status || 'Empty',
        pricePerKg: machine.storage2?.pricePerKg || 165,
        name: machine.storage2?.name || 'AOZI',
        maxCapacity: machine.storage2?.maxCapacity || 20
      },
      batteryPercentage: machine.battery?.percentage || 100,
      batteryVoltage: machine.battery?.voltage || 12.6,
      doorStatus: machine.machineStatus?.doorStatus || 'Closed',
      temperature: machine.machineStatus?.temperature || 25,
      totalStock: (machine.storage1?.currentWeight || 0) + (machine.storage2?.currentWeight || 0),
      machineStatus: machine.machineStatus?.isOnline ? 'ONLINE' : 'OFFLINE',
      lastUpdate: machine.machineStatus?.lastUpdate || null,
      transactionCount: machine.machineStatus?.transactionCount || 0
    });
    
  } catch (error) {
    console.error('❌ Error fetching latest:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// ESP32 SENSOR UPDATE ENDPOINT
// ============================================

router.post('/sensors/update', async (req, res) => {
  console.log('📡 ESP32 Sensor Data Received');
  
  try {
    const {
      loadCellLeft,    // PEDIGREE (Left)
      loadCellRight,   // AOZI (Right)
      batteryPercentage,
      batteryVoltage,
      doorStatus,
      temperature,
      machineState,
      transactionCount,
      machineStatus
    } = req.body;

    console.log(`   LoadCellLeft (PEDIGREE): ${loadCellLeft}kg`);
    console.log(`   LoadCellRight (AOZI): ${loadCellRight}kg`);
    console.log(`   Battery: ${batteryPercentage || batteryVoltage}`);
    console.log(`   Door: ${doorStatus}`);
    console.log(`   State: ${machineState}`);

    const machine = await getOrCreateMachine();
    
    // Update storage1 (PEDIGREE)
    if (loadCellLeft !== undefined && loadCellLeft !== null) {
      machine.storage1.currentWeight = parseFloat(loadCellLeft) || 0;
      const maxCap = machine.storage1.maxCapacity || 20;
      machine.storage1.percentage = Math.min((parseFloat(loadCellLeft) / maxCap) * 100, 100);
      machine.storage1.status = parseFloat(loadCellLeft) <= 0.05 ? 'Empty' : 
                                 parseFloat(loadCellLeft) < 2 ? 'Low' : 'Normal';
    }
    
    // Update storage2 (AOZI)
    if (loadCellRight !== undefined && loadCellRight !== null) {
      machine.storage2.currentWeight = parseFloat(loadCellRight) || 0;
      const maxCap = machine.storage2.maxCapacity || 20;
      machine.storage2.percentage = Math.min((parseFloat(loadCellRight) / maxCap) * 100, 100);
      machine.storage2.status = parseFloat(loadCellRight) <= 0.05 ? 'Empty' : 
                                 parseFloat(loadCellRight) < 2 ? 'Low' : 'Normal';
    }
    
    // Update battery
    if (batteryPercentage !== undefined && batteryPercentage !== null) {
      machine.battery.percentage = parseInt(batteryPercentage) || 100;
      machine.battery.status = machine.battery.percentage > 70 ? 'Good' : 
                               machine.battery.percentage > 30 ? 'Warning' : 'Critical';
    }
    if (batteryVoltage !== undefined && batteryVoltage !== null) {
      machine.battery.voltage = parseFloat(batteryVoltage) || 12.6;
    }
    
    // Update door status
    if (doorStatus) {
      machine.machineStatus.doorStatus = doorStatus === 'OPEN' ? 'Open' : 'Closed';
    }
    
    // Update temperature
    if (temperature !== undefined && temperature !== null) {
      machine.machineStatus.temperature = parseFloat(temperature) || 25;
    }
    
    // Update transaction count
    if (transactionCount !== undefined && transactionCount !== null) {
      machine.machineStatus.transactionCount = parseInt(transactionCount) || 0;
    }
    
    // Update machine state
    if (machineState !== undefined && machineState !== null) {
      machine.machineStatus.machineState = parseInt(machineState) || 0;
    }
    
    machine.machineStatus.lastUpdate = new Date();
    machine.machineStatus.isOnline = true;
    machine.updatedAt = new Date();
    
    await machine.save();
    
    console.log(`✅ Machine updated!`);
    console.log(`   PEDIGREE: ${machine.storage1.currentWeight}kg (${machine.storage1.percentage.toFixed(1)}%)`);
    console.log(`   AOZI: ${machine.storage2.currentWeight}kg (${machine.storage2.percentage.toFixed(1)}%)`);
    console.log(`   Battery: ${machine.battery.percentage}%`);
    
    // Emit socket event for real-time updates
    emitSocketEvent(req, 'sensor_update', {
      storage1: machine.storage1,
      storage2: machine.storage2,
      battery: machine.battery,
      doorStatus: machine.machineStatus.doorStatus,
      timestamp: new Date()
    });
    
    res.json({ 
      success: true, 
      message: 'Machine updated successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error updating sensors:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// PRICE & PRODUCT MANAGEMENT
// ============================================

// Get product prices for ESP32
router.get('/prices/current', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    const aoziPrice = machine.storage2?.pricePerKg || 165;
    const pedigreePrice = machine.storage1?.pricePerKg || 135;
    
    console.log(`💰 Sending prices to ESP32: AOZI=${aoziPrice}, PEDIGREE=${pedigreePrice}`);
    
    res.json({
      success: true,
      prices: {
        aozi: aoziPrice,
        pedigree: pedigreePrice
      },
      products: {
        aozi_name: machine.storage2?.name || 'AOZI',
        pedigree_name: machine.storage1?.name || 'PEDIGREE'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get product names and prices for website
router.get('/products/current', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    res.json({
      success: true,
      storage1: {
        name: machine.storage1.name || 'PEDIGREE',
        pricePerKg: machine.storage1.pricePerKg || 135,
        currentWeight: machine.storage1.currentWeight || 0,
        status: machine.storage1.status || 'Empty'
      },
      storage2: {
        name: machine.storage2.name || 'AOZI',
        pricePerKg: machine.storage2.pricePerKg || 165,
        currentWeight: machine.storage2.currentWeight || 0,
        status: machine.storage2.status || 'Empty'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update product price (from website)
router.post('/prices/update', async (req, res) => {
  try {
    const { aoziPrice, pedigreePrice } = req.body;
    
    const machine = await getOrCreateMachine();
    let updated = false;
    
    if (aoziPrice !== undefined && aoziPrice !== null) {
      const price = parseFloat(aoziPrice);
      if (price > 0) {
        machine.storage2.pricePerKg = price;
        console.log(`💰 AOZI price updated: PHP ${price}`);
        updated = true;
      }
    }
    
    if (pedigreePrice !== undefined && pedigreePrice !== null) {
      const price = parseFloat(pedigreePrice);
      if (price > 0) {
        machine.storage1.pricePerKg = price;
        console.log(`💰 PEDIGREE price updated: PHP ${price}`);
        updated = true;
      }
    }
    
    if (updated) {
      await machine.save();
      
      // Emit socket event
      emitSocketEvent(req, 'price_updated', {
        aozi: machine.storage2.pricePerKg,
        pedigree: machine.storage1.pricePerKg
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Prices updated successfully',
      data: {
        aozi: machine.storage2.pricePerKg,
        pedigree: machine.storage1.pricePerKg
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating prices:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update product name
router.put('/product/update/:storageId', async (req, res) => {
  try {
    const { storageId } = req.params;
    const { name, pricePerKg } = req.body;
    
    console.log(`📝 Updating Storage ${storageId}: Name="${name}", Price=${pricePerKg}`);
    
    const machine = await getOrCreateMachine();
    
    if (storageId === '1') {
      if (name) machine.storage1.name = name;
      if (pricePerKg !== undefined && pricePerKg !== null) {
        const price = parseFloat(pricePerKg);
        if (price > 0) machine.storage1.pricePerKg = price;
      }
      console.log(`✅ Storage 1 updated: ${machine.storage1.name} @ PHP ${machine.storage1.pricePerKg}/kg`);
    } else if (storageId === '2') {
      if (name) machine.storage2.name = name;
      if (pricePerKg !== undefined && pricePerKg !== null) {
        const price = parseFloat(pricePerKg);
        if (price > 0) machine.storage2.pricePerKg = price;
      }
      console.log(`✅ Storage 2 updated: ${machine.storage2.name} @ PHP ${machine.storage2.pricePerKg}/kg`);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid storage ID' 
      });
    }
    
    await machine.save();
    
    // Emit socket event
    emitSocketEvent(req, 'product_updated', {
      storageId,
      name: name,
      pricePerKg: pricePerKg
    });
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: storageId === '1' ? machine.storage1 : machine.storage2
    });
    
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// TRANSACTIONS
// ============================================

router.post('/transaction/confirm', async (req, res) => {
  console.log('📝 ESP32 Transaction received');
  
  try {
    const { 
      transactionId, 
      productType, 
      quantityKg, 
      amountPaid, 
      status,
      source,
      riceType
    } = req.body;
    
    // Support both old and new field names
    const product = productType || riceType;
    
    if (!product) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product type is required' 
      });
    }
    
    if (!quantityKg || !amountPaid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity and amount are required' 
      });
    }
    
    // Map product types
    let productName, pricePerKg;
    
    if (product.toUpperCase() === 'AOZI') {
      productName = 'AOZI';
      pricePerKg = 165.0;
    } else if (product.toUpperCase() === 'PEDIGREE') {
      productName = 'PEDIGREE';
      pricePerKg = 135.0;
    } else {
      productName = product;
      pricePerKg = 135.0;
    }
    
    // Check for duplicate
    if (transactionId) {
      const existing = await Transaction.findOne({ transactionId });
      if (existing) {
        console.log(`⚠️ Transaction ${transactionId} already exists`);
        return res.json({ 
          success: true, 
          message: 'Transaction already exists',
          alreadyExists: true 
        });
      }
    }
    
    const transaction = new Transaction({
      transactionId: transactionId || `TXN-${Date.now()}`,
      productName: productName,
      quantityKg: parseFloat(quantityKg),
      pricePerKg: pricePerKg,
      amountPaid: parseFloat(amountPaid),
      paymentMethod: 'CASH',
      status: status || 'COMPLETED',
      source: source || 'machine',
      notes: `Auto-recorded by vending machine.`
    });
    
    await transaction.save();
    
    console.log(`✅ Transaction saved: ${transaction.transactionId}`);
    console.log(`   Product: ${productName}, ${quantityKg}kg, PHP ${amountPaid}`);
    
    // Update machine transaction count
    const machine = await getOrCreateMachine();
    machine.machineStatus.transactionCount = (machine.machineStatus.transactionCount || 0) + 1;
    await machine.save();
    
    // Emit socket event
    emitSocketEvent(req, 'new_transaction', {
      transactionId: transaction.transactionId,
      productName: transaction.productName,
      quantityKg: transaction.quantityKg,
      amountPaid: transaction.amountPaid,
      source: 'machine'
    });
    
    res.json({ 
      success: true, 
      message: 'Transaction recorded successfully' 
    });
    
  } catch (error) {
    console.error('❌ Transaction error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get transactions
router.get('/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    
    const transactions = await Transaction.find({ source: 'machine' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Transaction.countDocuments({ source: 'machine' });
    
    res.json({
      success: true,
      total,
      count: transactions.length,
      transactions
    });
    
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// CASH MANAGEMENT
// ============================================

router.post('/cash/update', async (req, res) => {
  console.log('💰 Cash data received');
  
  try {
    const { 
      totalCash, 
      coinsValue, 
      billsValue,
      coins,
      bills,
      deviceId 
    } = req.body;
    
    const machine = await getOrCreateMachine();
    
    if (!machine.cash) {
      machine.cash = {};
    }
    
    machine.cash.totalCollected = parseFloat(totalCash) || 0;
    machine.cash.coinsValue = parseFloat(coinsValue) || 0;
    machine.cash.billsValue = parseFloat(billsValue) || 0;
    
    if (coins) {
      machine.cash.coins = {
        '1': coins['1'] || 0,
        '5': coins['5'] || 0,
        '10': coins['10'] || 0,
        '20': coins['20'] || 0
      };
    }
    
    if (bills) {
      machine.cash.bills = {
        '20': bills['20'] || 0,
        '50': bills['50'] || 0,
        '100': bills['100'] || 0,
        '200': bills['200'] || 0
      };
    }
    
    machine.cash.lastUpdated = new Date();
    await machine.save();
    
    emitSocketEvent(req, 'cash_updated', {
      totalCash: machine.cash.totalCollected,
      timestamp: new Date()
    });
    
    res.json({ success: true, message: 'Cash data updated' });
    
  } catch (error) {
    console.error('❌ Cash update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/cash/collect', async (req, res) => {
  console.log('💰 Cash collected!');
  
  try {
    const machine = await getOrCreateMachine();
    
    const collectedData = {
      totalCash: machine.cash?.totalCollected || 0,
      coinsValue: machine.cash?.coinsValue || 0,
      billsValue: machine.cash?.billsValue || 0,
      coins: machine.cash?.coins || {},
      bills: machine.cash?.bills || {},
      collectedAt: new Date()
    };
    
    // Reset cash counters
    if (machine.cash) {
      machine.cash.totalCollected = 0;
      machine.cash.coinsValue = 0;
      machine.cash.billsValue = 0;
      machine.cash.coins = { '1': 0, '5': 0, '10': 0, '20': 0 };
      machine.cash.bills = { '20': 0, '50': 0, '100': 0, '200': 0 };
      machine.cash.lastUpdated = new Date();
      machine.cash.lastCollected = new Date();
      await machine.save();
    }
    
    emitSocketEvent(req, 'cash_collected', collectedData);
    
    res.json({ 
      success: true, 
      message: 'Cash collected and reset',
      collected: collectedData
    });
    
  } catch (error) {
    console.error('❌ Cash collection error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// CALIBRATION
// ============================================

router.post('/calibration/update', async (req, res) => {
  console.log('🔧 Calibration data received');
  
  try {
    const { target, factor, rawValue, calibratedValue, deviceId } = req.body;
    
    const machine = await getOrCreateMachine();
    
    if (!machine.calibration) {
      machine.calibration = {};
    }
    
    if (target === 'STORAGE1') {
      machine.calibration.storage1 = { factor, rawValue, calibratedValue, updatedAt: new Date() };
    } else if (target === 'STORAGE2') {
      machine.calibration.storage2 = { factor, rawValue, calibratedValue, updatedAt: new Date() };
    } else if (target === 'DISPENSE') {
      machine.calibration.dispense = { factor, rawValue, calibratedValue, updatedAt: new Date() };
    }
    
    await machine.save();
    res.json({ success: true, message: 'Calibration data saved' });
    
  } catch (error) {
    console.error('❌ Calibration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/calibration/command/pending', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    // Check if there's a pending calibration command
    const pendingCommand = machine.calibration?.pendingCommand || null;
    
    // Clear the pending command after sending
    if (pendingCommand && machine.calibration) {
      machine.calibration.pendingCommand = null;
      await machine.save();
    }
    
    res.json({
      success: true,
      command: pendingCommand
    });
    
  } catch (error) {
    console.error('❌ Error fetching calibration command:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// SECURITY
// ============================================

router.post('/security/alert', async (req, res) => {
  console.log('🚨 Security Alert:', req.body);
  
  const { alertType, deviceId, timestamp } = req.body;
  
  // Emit socket event
  emitSocketEvent(req, 'security_alert', {
    alertType,
    deviceId,
    timestamp: new Date(timestamp || Date.now())
  });
  
  // Save to machine if needed
  try {
    const machine = await getOrCreateMachine();
    if (!machine.security) {
      machine.security = { alerts: [] };
    }
    if (!machine.security.alerts) {
      machine.security.alerts = [];
    }
    machine.security.alerts.push({
      type: alertType,
      timestamp: new Date(timestamp || Date.now())
    });
    // Keep only last 50 alerts
    if (machine.security.alerts.length > 50) {
      machine.security.alerts = machine.security.alerts.slice(-50);
    }
    await machine.save();
  } catch (error) {
    console.error('Error saving security alert:', error);
  }
  
  res.json({ success: true });
});

// ============================================
// PUBLIC ENDPOINTS
// ============================================

router.get('/public/latest', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    res.json({
      success: true,
      data: {
        storage1: {
          currentWeight: machine.storage1.currentWeight || 0,
          percentage: machine.storage1.percentage || 0,
          status: machine.storage1.status || 'Empty',
          name: machine.storage1.name || 'PEDIGREE'
        },
        storage2: {
          currentWeight: machine.storage2.currentWeight || 0,
          percentage: machine.storage2.percentage || 0,
          status: machine.storage2.status || 'Empty',
          name: machine.storage2.name || 'AOZI'
        },
        totalStock: (machine.storage1.currentWeight || 0) + (machine.storage2.currentWeight || 0),
        batteryPercentage: machine.battery?.percentage || 100,
        doorStatus: machine.machineStatus?.doorStatus || 'Closed',
        machineStatus: machine.machineStatus?.isOnline ? 'ONLINE' : 'OFFLINE',
        lastUpdate: machine.machineStatus?.lastUpdate || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/public/storage/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await getOrCreateMachine();
    
    const storage = id === '1' ? machine.storage1 : machine.storage2;
    
    res.json({
      success: true,
      data: {
        level: storage.currentWeight || 0,
        maxLevel: storage.maxCapacity || 20,
        percentage: storage.percentage || 0,
        fillLevel: (storage.percentage || 0).toFixed(1) + '%',
        status: storage.status || 'Empty',
        remainingKg: storage.currentWeight || 0,
        name: storage.name || (id === '1' ? 'PEDIGREE' : 'AOZI')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/public/summary', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    res.json({
      success: true,
      data: {
        totalStock: (machine.storage1.currentWeight || 0) + (machine.storage2.currentWeight || 0),
        batteryPercentage: machine.battery?.percentage || 100,
        doorStatus: machine.machineStatus?.doorStatus || 'Closed',
        machineStatus: machine.machineStatus?.isOnline ? 'ONLINE' : 'OFFLINE',
        transactionCount: machine.machineStatus?.transactionCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// STOCK & STATUS
// ============================================

router.get('/stock', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    res.json({
      success: true,
      aozi: {
        kg: machine.storage2?.currentWeight || 0,
        status: machine.storage2?.status || 'Empty',
        percentage: machine.storage2?.percentage || 0,
        name: machine.storage2?.name || 'AOZI',
        maxCapacity: machine.storage2?.maxCapacity || 20
      },
      pedigree: {
        kg: machine.storage1?.currentWeight || 0,
        status: machine.storage1?.status || 'Empty',
        percentage: machine.storage1?.percentage || 0,
        name: machine.storage1?.name || 'PEDIGREE',
        maxCapacity: machine.storage1?.maxCapacity || 20
      },
      total: (machine.storage1?.currentWeight || 0) + (machine.storage2?.currentWeight || 0),
      battery: {
        percentage: machine.battery?.percentage || 100,
        status: machine.battery?.status || 'Good'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/machine/status', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    res.json({ 
      success: true, 
      data: {
        isOnline: machine.machineStatus?.isOnline || false,
        doorStatus: machine.machineStatus?.doorStatus || 'Closed',
        transactionCount: machine.machineStatus?.transactionCount || 0,
        lastUpdate: machine.machineStatus?.lastUpdate || null,
        machineState: machine.machineStatus?.machineState || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DEBUG
// ============================================

router.get('/debug', async (req, res) => {
  try {
    const machines = await Machine.find({});
    
    console.log('=== DATABASE CONTENTS ===');
    machines.forEach((m, i) => {
      console.log(`Machine ${i + 1}:`);
      console.log(`  PEDIGREE: ${m.storage1?.currentWeight}kg @ PHP ${m.storage1?.pricePerKg}`);
      console.log(`  AOZI: ${m.storage2?.currentWeight}kg @ PHP ${m.storage2?.pricePerKg}`);
      console.log(`  Battery: ${m.battery?.percentage}%`);
    });
    
    res.json({
      totalMachines: machines.length,
      machines: machines.map(m => ({
        id: m._id,
        pedigree: { 
          weight: m.storage1?.currentWeight, 
          price: m.storage1?.pricePerKg, 
          name: m.storage1?.name 
        },
        aozi: { 
          weight: m.storage2?.currentWeight, 
          price: m.storage2?.pricePerKg, 
          name: m.storage2?.name 
        },
        battery: m.battery?.percentage,
        online: m.machineStatus?.isOnline,
        lastUpdate: m.machineStatus?.lastUpdate
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WEBSITE ENDPOINTS
// ============================================

// Get all products with prices
router.get('/website/products', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    res.json({
      success: true,
      products: [
        {
          id: '1',
          name: machine.storage1.name || 'PEDIGREE',
          price: machine.storage1.pricePerKg || 135,
          currentWeight: machine.storage1.currentWeight || 0,
          status: machine.storage1.status || 'Empty'
        },
        {
          id: '2',
          name: machine.storage2.name || 'AOZI',
          price: machine.storage2.pricePerKg || 165,
          currentWeight: machine.storage2.currentWeight || 0,
          status: machine.storage2.status || 'Empty'
        }
      ]
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product from website
router.post('/website/product/update', async (req, res) => {
  try {
    const { productId, name, price } = req.body;
    
    const machine = await getOrCreateMachine();
    
    if (productId === '1') {
      if (name) machine.storage1.name = name;
      if (price && price > 0) machine.storage1.pricePerKg = parseFloat(price);
    } else if (productId === '2') {
      if (name) machine.storage2.name = name;
      if (price && price > 0) machine.storage2.pricePerKg = parseFloat(price);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }
    
    await machine.save();
    
    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;