import express from 'express';
import Transaction from '../models/Transaction.js';
import Machine from '../models/Machine.js';
import mongoose from 'mongoose';

const router = express.Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getOrCreateMachine() {
  let machine = await Machine.findOne({});
  if (!machine) {
    machine = new Machine({
      storage1: { 
        name: 'PEDIGREE', 
        currentWeight: 0, 
        maxCapacity: 20, 
        pricePerKg: 135 
      },
      storage2: { 
        name: 'AOZI', 
        currentWeight: 0, 
        maxCapacity: 20, 
        pricePerKg: 165 
      },
      battery: { percentage: 100, status: 'Good', voltage: 12.6 },
      machineStatus: { doorStatus: 'Closed', isOnline: false, transactionCount: 0 }
    });
    await machine.save();
    console.log('📦 Created new machine document');
  }
  return machine;
}

function emitSocketEvent(req, event, data) {
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit(event, data);
    }
  } catch (error) {
    // Socket not available
  }
}

// ============================================
// TEST ENDPOINT
// ============================================

router.get('/test', (req, res) => {
  console.log('📡 ESP32 Test endpoint hit');
  res.json({
    success: true,
    message: 'AGRIVEND ESP32 Routes Working!',
    deviceId: 'AGRIVEND_001',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ESP32 PRICE ENDPOINTS - CORRECT MAPPING
// ============================================

// Get prices for ESP32
router.get('/prices/current', async (req, res) => {
  try {
    const machine = await getOrCreateMachine();
    
    // IMPORTANT MAPPING:
    // Storage1 = PEDIGREE (Left LCD - 0x26)
    // Storage2 = AOZI (Right LCD - 0x27)
    const pedigreePrice = machine.storage1?.pricePerKg || 135;
    const aoziPrice = machine.storage2?.pricePerKg || 165;
    
    console.log(`💰 Sending prices to ESP32:`);
    console.log(`   PEDIGREE (Storage1): PHP ${pedigreePrice}`);
    console.log(`   AOZI (Storage2): PHP ${aoziPrice}`);
    
    // Format: PRICE|AOZI_PRICE|PEDIGREE_PRICE
    // This matches Arduino parsePriceData() which expects: PRICE|aozi|pedigree
    res.json({
      success: true,
      prices: {
        aozi: aoziPrice,      // Storage2 - AOZI (Right LCD)
        pedigree: pedigreePrice // Storage1 - PEDIGREE (Left LCD)
      },
      products: {
        aozi_name: machine.storage2?.name || 'AOZI',
        pedigree_name: machine.storage1?.name || 'PEDIGREE'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product names for ESP32
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WEBSITE PRODUCT UPDATE - FIXED MAPPING
// ============================================

// Update product from website - CORRECT MAPPING
router.post('/website/product/update', async (req, res) => {
  try {
    const { productId, name, price } = req.body;
    
    console.log(`📝 Website updating product:`);
    console.log(`   ID: ${productId}`);
    console.log(`   Name: ${name}`);
    console.log(`   Price: ${price}`);
    
    const machine = await getOrCreateMachine();
    
    // CORRECT MAPPING:
    // productId '1' = Storage1 = PEDIGREE (Left LCD)
    // productId '2' = Storage2 = AOZI (Right LCD)
    if (productId === '1') {
      if (name) machine.storage1.name = name.toUpperCase();
      if (price && price > 0) machine.storage1.pricePerKg = parseFloat(price);
      console.log(`✅ PEDIGREE (Storage1 - Left LCD) updated: ${machine.storage1.name} @ PHP ${machine.storage1.pricePerKg}`);
    } else if (productId === '2') {
      if (name) machine.storage2.name = name.toUpperCase();
      if (price && price > 0) machine.storage2.pricePerKg = parseFloat(price);
      console.log(`✅ AOZI (Storage2 - Right LCD) updated: ${machine.storage2.name} @ PHP ${machine.storage2.pricePerKg}`);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }
    
    await machine.save();
    
    // Send updated prices to ESP32
    // Format: PRICE|AOZI_PRICE|PEDIGREE_PRICE
    const priceCmd = `PRICE|${machine.storage2.pricePerKg}|${machine.storage1.pricePerKg}`;
    const nameCmd = `NAMES|${machine.storage2.name}|${machine.storage1.name}`;
    
    console.log(`📤 ESP32 Commands:`);
    console.log(`   ${priceCmd}`);
    console.log(`   ${nameCmd}`);
    
    // Emit socket events for real-time updates
    emitSocketEvent(req, 'product_updated', {
      storage1: machine.storage1,
      storage2: machine.storage2
    });
    
    // Return the updated data
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        storage1: machine.storage1,
        storage2: machine.storage2
      },
      esp32_commands: {
        price: priceCmd,
        names: nameCmd
      }
    });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WEBSITE GET PRODUCTS
// ============================================

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
          status: machine.storage1.status || 'Empty',
          storage: 'Storage 1 (Left LCD)',
          displayName: 'PEDIGREE'
        },
        {
          id: '2',
          name: machine.storage2.name || 'AOZI',
          price: machine.storage2.pricePerKg || 165,
          currentWeight: machine.storage2.currentWeight || 0,
          status: machine.storage2.status || 'Empty',
          storage: 'Storage 2 (Right LCD)',
          displayName: 'AOZI'
        }
      ]
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// UPDATE PRICE (Website)
// ============================================

router.post('/prices/update', async (req, res) => {
  try {
    const { aoziPrice, pedigreePrice } = req.body;
    
    const machine = await getOrCreateMachine();
    let updated = false;
    
    if (aoziPrice !== undefined && aoziPrice !== null) {
      const price = parseFloat(aoziPrice);
      if (price > 0) {
        machine.storage2.pricePerKg = price; // AOZI (Storage2)
        console.log(`💰 AOZI price updated: PHP ${price}`);
        updated = true;
      }
    }
    
    if (pedigreePrice !== undefined && pedigreePrice !== null) {
      const price = parseFloat(pedigreePrice);
      if (price > 0) {
        machine.storage1.pricePerKg = price; // PEDIGREE (Storage1)
        console.log(`💰 PEDIGREE price updated: PHP ${price}`);
        updated = true;
      }
    }
    
    if (updated) {
      await machine.save();
      
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

// Update product name (PUT endpoint)
router.put('/product/update/:storageId', async (req, res) => {
  try {
    const { storageId } = req.params;
    const { name, pricePerKg } = req.body;
    
    console.log(`📝 Updating Storage ${storageId}: Name="${name}", Price=${pricePerKg}`);
    
    const machine = await getOrCreateMachine();
    
    if (storageId === '1') {
      // Storage1 = PEDIGREE (Left LCD)
      if (name) machine.storage1.name = name.toUpperCase();
      if (pricePerKg !== undefined && pricePerKg !== null) {
        const price = parseFloat(pricePerKg);
        if (price > 0) machine.storage1.pricePerKg = price;
      }
      console.log(`✅ PEDIGREE (Storage1) updated: ${machine.storage1.name} @ PHP ${machine.storage1.pricePerKg}/kg`);
    } else if (storageId === '2') {
      // Storage2 = AOZI (Right LCD)
      if (name) machine.storage2.name = name.toUpperCase();
      if (pricePerKg !== undefined && pricePerKg !== null) {
        const price = parseFloat(pricePerKg);
        if (price > 0) machine.storage2.pricePerKg = price;
      }
      console.log(`✅ AOZI (Storage2) updated: ${machine.storage2.name} @ PHP ${machine.storage2.pricePerKg}/kg`);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid storage ID' 
      });
    }
    
    await machine.save();
    
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
// ESP32 SENSOR UPDATE
// ============================================

router.post('/sensors/update', async (req, res) => {
  console.log('📡 ESP32 Sensor Data Received');
  
  try {
    const {
      loadCellLeft,    // PEDIGREE (Left) - Storage1
      loadCellRight,   // AOZI (Right) - Storage2
      batteryPercentage,
      batteryVoltage,
      doorStatus,
      temperature,
      machineState,
      transactionCount,
      machineStatus
    } = req.body;

    console.log(`   LoadCellLeft (PEDIGREE - Storage1): ${loadCellLeft}kg`);
    console.log(`   LoadCellRight (AOZI - Storage2): ${loadCellRight}kg`);
    console.log(`   Battery: ${batteryPercentage || batteryVoltage}`);
    console.log(`   Door: ${doorStatus}`);

    const machine = await getOrCreateMachine();
    
    // Update storage1 (PEDIGREE - Left LCD)
    if (loadCellLeft !== undefined && loadCellLeft !== null) {
      machine.storage1.currentWeight = parseFloat(loadCellLeft) || 0;
      const maxCap = machine.storage1.maxCapacity || 20;
      machine.storage1.percentage = Math.min((parseFloat(loadCellLeft) / maxCap) * 100, 100);
      machine.storage1.status = parseFloat(loadCellLeft) <= 0.05 ? 'Empty' : 
                                 parseFloat(loadCellLeft) < 2 ? 'Low' : 'Normal';
    }
    
    // Update storage2 (AOZI - Right LCD)
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
    console.log(`   PEDIGREE (Storage1): ${machine.storage1.currentWeight}kg (${machine.storage1.percentage.toFixed(1)}%)`);
    console.log(`   AOZI (Storage2): ${machine.storage2.currentWeight}kg (${machine.storage2.percentage.toFixed(1)}%)`);
    console.log(`   Battery: ${machine.battery.percentage}%`);
    
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
      source
    } = req.body;
    
    const product = productType;
    
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
    
    const machine = await getOrCreateMachine();
    machine.machineStatus.transactionCount = (machine.machineStatus.transactionCount || 0) + 1;
    await machine.save();
    
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
    const { totalCash, coinsValue, billsValue, coins, bills } = req.body;
    
    const machine = await getOrCreateMachine();
    
    if (!machine.cash) machine.cash = {};
    
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
    const { target, factor, rawValue, calibratedValue } = req.body;
    
    const machine = await getOrCreateMachine();
    
    if (!machine.calibration) machine.calibration = {};
    
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
    
    const pendingCommand = machine.calibration?.pendingCommand || null;
    
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
  
  emitSocketEvent(req, 'security_alert', {
    alertType,
    deviceId,
    timestamp: new Date(timestamp || Date.now())
  });
  
  try {
    const machine = await getOrCreateMachine();
    if (!machine.security) machine.security = { alerts: [] };
    if (!machine.security.alerts) machine.security.alerts = [];
    
    machine.security.alerts.push({
      type: alertType,
      timestamp: new Date(timestamp || Date.now())
    });
    
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
      console.log(`  PEDIGREE (Storage1): ${m.storage1?.currentWeight}kg @ PHP ${m.storage1?.pricePerKg} - Name: ${m.storage1?.name}`);
      console.log(`  AOZI (Storage2): ${m.storage2?.currentWeight}kg @ PHP ${m.storage2?.pricePerKg} - Name: ${m.storage2?.name}`);
      console.log(`  Battery: ${m.battery?.percentage}%`);
    });
    
    res.json({
      totalMachines: machines.length,
      machines: machines.map(m => ({
        id: m._id,
        storage1: { 
          name: m.storage1?.name,
          weight: m.storage1?.currentWeight, 
          price: m.storage1?.pricePerKg
        },
        storage2: { 
          name: m.storage2?.name,
          weight: m.storage2?.currentWeight, 
          price: m.storage2?.pricePerKg
        },
        battery: m.battery?.percentage,
        online: m.machineStatus?.isOnline
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;