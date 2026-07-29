import express from 'express';
import Machine from '../models/Machine.js';
import { protect, admin, staff } from '../middleware/auth.js';

const router = express.Router();

// ==================== GET MACHINE DATA ====================
// Staff and Admin can view machine data
router.get('/data', protect, async (req, res) => {
  try {
    let machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine) {
      // Return default machine data if none exists
      return res.json({
        success: true,
        data: {
          storage1: {
            name: 'Sinandomeng Rice',
            pricePerKg: 54,
            currentWeight: 15.5,
            maxCapacity: 20,
            percentage: 77.5,
            status: 'Normal',
            isLow: false
          },
          storage2: {
            name: 'Dinorado Rice',
            pricePerKg: 65,
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
            isCharging: true,
            health: 'Good'
          },
          machineStatus: {
            isOnline: true,
            temperature: 32.5,
            doorStatus: 'Closed',
            securityStatus: 'Safe',
            lastUpdate: new Date()
          },
          cash: {
            coins: { onePeso: 0, fivePeso: 0, tenPeso: 0, twentyPeso: 0 },
            bills: { twenty: 0, fifty: 0, hundred: 0, twoHundred: 0 },
            total: 0
          },
          calibration: {
            storage1: { unit: 'kg', status: 'Stable' },
            storage2: { unit: 'kg', status: 'Stable' },
            dispense: { unit: 'kg', status: 'Stable' }
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus,
        cash: machine.cash,
        calibration: machine.calibration
      }
    });
  } catch (error) {
    console.error('Error fetching machine data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch machine data' });
  }
});

// ==================== UPDATE MACHINE DATA (from Arduino/ESP32) ====================
router.post('/update', async (req, res) => {
  try {
    const { 
      storage1Weight, storage2Weight, 
      batteryPercentage, batteryVoltage, 
      temperature, doorStatus,
      coinInserted, billInserted 
    } = req.body;
    
    let machine = await Machine.findOne();
    
    if (!machine) {
      machine = new Machine();
    }
    
    // Update storage 1
    if (storage1Weight !== undefined) {
      machine.storage1.currentWeight = storage1Weight;
      machine.storage1.percentage = (storage1Weight / machine.storage1.maxCapacity) * 100;
      machine.storage1.status = storage1Weight < 5 ? 'Critical' : storage1Weight < 10 ? 'Low' : 'Normal';
      machine.storage1.isLow = storage1Weight < 10;
      machine.storage1.lastUpdated = new Date();
    }
    
    // Update storage 2
    if (storage2Weight !== undefined) {
      machine.storage2.currentWeight = storage2Weight;
      machine.storage2.percentage = (storage2Weight / machine.storage2.maxCapacity) * 100;
      machine.storage2.status = storage2Weight < 5 ? 'Critical' : storage2Weight < 10 ? 'Low' : 'Normal';
      machine.storage2.isLow = storage2Weight < 10;
      machine.storage2.lastUpdated = new Date();
    }
    
    // Update battery
    if (batteryPercentage !== undefined) {
      machine.battery.percentage = batteryPercentage;
      machine.battery.voltage = batteryVoltage || machine.battery.voltage;
      machine.battery.status = batteryPercentage > 70 ? 'Good' : batteryPercentage > 30 ? 'Warning' : 'Critical';
      machine.battery.health = batteryPercentage > 70 ? 'Good' : batteryPercentage > 30 ? 'Warning' : 'Critical';
      machine.battery.lastUpdated = new Date();
    }
    
    // Update machine status
    if (temperature !== undefined) machine.machineStatus.temperature = temperature;
    if (doorStatus !== undefined) machine.machineStatus.doorStatus = doorStatus;
    machine.machineStatus.lastUpdate = new Date();
    
    // Handle coin insertion
    if (coinInserted !== undefined) {
      const coinMap = {
        1: 'onePeso',
        5: 'fivePeso', 
        10: 'tenPeso',
        20: 'twentyPeso'
      };
      const key = coinMap[coinInserted];
      if (key && machine.cash && machine.cash.coins) {
        machine.cash.coins[key] = (machine.cash.coins[key] || 0) + 1;
        machine.cash.lastUpdated = new Date();
      }
    }
    
    // Handle bill insertion
    if (billInserted !== undefined) {
      const billMap = {
        20: 'twenty',
        50: 'fifty',
        100: 'hundred',
        200: 'twoHundred'
      };
      const key = billMap[billInserted];
      if (key && machine.cash && machine.cash.bills) {
        machine.cash.bills[key] = (machine.cash.bills[key] || 0) + 1;
        machine.cash.lastUpdated = new Date();
      }
    }
    
    // Add sensor history
    if (!machine.sensorHistory) machine.sensorHistory = [];
    machine.sensorHistory.push({
      storage1Weight: machine.storage1.currentWeight,
      storage2Weight: machine.storage2.currentWeight,
      batteryPercentage: machine.battery.percentage,
      temperature: machine.machineStatus.temperature,
      doorStatus: machine.machineStatus.doorStatus,
      timestamp: new Date()
    });
    
    // Keep only last 1000 records
    if (machine.sensorHistory.length > 1000) {
      machine.sensorHistory = machine.sensorHistory.slice(-1000);
    }
    
    await machine.save();
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('machine_data_updated', {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus,
        cash: machine.cash
      });
      
      // Check for low stock alerts
      if (machine.storage1.isLow) {
        io.emit('low_stock_alert', {
          storageId: 1,
          storageName: machine.storage1.name,
          remainingKg: machine.storage1.currentWeight
        });
      }
      
      if (machine.storage2.isLow) {
        io.emit('low_stock_alert', {
          storageId: 2,
          storageName: machine.storage2.name,
          remainingKg: machine.storage2.currentWeight
        });
      }
      
      // Check for low battery alert
      if (machine.battery.percentage < 20) {
        io.emit('low_battery_alert', {
          percentage: machine.battery.percentage,
          voltage: machine.battery.voltage
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Machine data updated successfully',
      data: {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus,
        cash: machine.cash
      }
    });
  } catch (error) {
    console.error('Error updating machine data:', error);
    res.status(500).json({ success: false, error: 'Failed to update machine data' });
  }
});

// ==================== REFILL STORAGE ====================
// Staff and Admin can refill storage
router.post('/refill', protect, staff, async (req, res) => {
  try {
    const { storageId, amount } = req.body;
    
    let machine = await Machine.findOne();
    
    if (!machine) {
      machine = new Machine();
    }
    
    const maxCapacity = 20;
    const percentage = (amount / maxCapacity) * 100;
    const status = amount < 5 ? 'Critical' : amount < 10 ? 'Low' : 'Normal';
    const isLow = amount < 10;
    
    if (storageId === 1) {
      machine.storage1.currentWeight = amount;
      machine.storage1.percentage = percentage;
      machine.storage1.status = status;
      machine.storage1.isLow = isLow;
      machine.storage1.lastUpdated = new Date();
    } else if (storageId === 2) {
      machine.storage2.currentWeight = amount;
      machine.storage2.percentage = percentage;
      machine.storage2.status = status;
      machine.storage2.isLow = isLow;
      machine.storage2.lastUpdated = new Date();
    } else {
      return res.status(400).json({ success: false, error: 'Invalid storage ID' });
    }
    
    machine.machineStatus.lastUpdate = new Date();
    await machine.save();
    
    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('machine_data_updated', {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus,
        cash: machine.cash
      });
    }
    
    res.json({
      success: true,
      message: `Storage ${storageId} refilled to ${amount}kg`,
      data: storageId === 1 ? machine.storage1 : machine.storage2
    });
  } catch (error) {
    console.error('Error refilling storage:', error);
    res.status(500).json({ success: false, error: 'Failed to refill storage' });
  }
});

// ==================== UPDATE PRODUCT PRICE ====================
// Staff and Admin can update product prices
router.put('/product/:storageId', protect, staff, async (req, res) => {
  try {
    const { storageId } = req.params;
    const { name, pricePerKg } = req.body;
    
    let machine = await Machine.findOne();
    
    if (!machine) {
      machine = new Machine();
    }
    
    if (storageId === '1') {
      if (name) machine.storage1.name = name;
      if (pricePerKg) machine.storage1.pricePerKg = parseFloat(pricePerKg);
    } else if (storageId === '2') {
      if (name) machine.storage2.name = name;
      if (pricePerKg) machine.storage2.pricePerKg = parseFloat(pricePerKg);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid storage ID' });
    }
    
    // Ensure battery status is valid
    if (!machine.battery) {
      machine.battery = {
        percentage: 78,
        voltage: 12.4,
        status: 'Good',
        health: 'Good',
        isCharging: true
      };
    } else if (!machine.battery.status) {
      machine.battery.status = 'Good';
    }
    
    await machine.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('machine_data_updated', {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus,
        cash: machine.cash
      });
    }
    
    res.json({
      success: true,
      message: `Product updated successfully`,
      data: storageId === '1' ? machine.storage1 : machine.storage2
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET MACHINE HISTORY ====================
router.get('/history', protect, admin, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine || !machine.sensorHistory) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const history = machine.sensorHistory.slice(-parseInt(limit));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching machine history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// ==================== GET MACHINE STATS ====================
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine) {
      return res.json({
        success: true,
        data: {
          totalStock: 23.7,
          batteryHealth: 'Good',
          avgTemperature: 32.5,
          uptime: '100%'
        }
      });
    }
    
    const totalStock = machine.storage1.currentWeight + machine.storage2.currentWeight;
    
    res.json({
      success: true,
      data: {
        totalStock,
        batteryHealth: machine.battery.health,
        batteryPercentage: machine.battery.percentage,
        avgTemperature: machine.machineStatus.temperature,
        doorStatus: machine.machineStatus.doorStatus,
        securityStatus: machine.machineStatus.securityStatus,
        totalCash: machine.cash?.total || 0,
        lastUpdate: machine.machineStatus.lastUpdate
      }
    });
  } catch (error) {
    console.error('Error fetching machine stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// ==================== COLLECT CASH ====================
router.post('/collect-cash', protect, staff, async (req, res) => {
  try {
    const { collectedBy, notes } = req.body;
    
    let machine = await Machine.findOne();
    
    if (!machine) {
      return res.status(404).json({ success: false, error: 'Machine data not found' });
    }
    
    const amount = machine.cash?.total || 0;
    
    if (amount === 0) {
      return res.status(400).json({ success: false, error: 'No cash to collect' });
    }
    
    // Record collection in history
    if (!machine.cash) machine.cash = { coins: {}, bills: {}, total: 0, history: [] };
    if (!machine.cash.history) machine.cash.history = [];
    
    machine.cash.history.push({
      collectedBy: collectedBy || 'Staff',
      amount: amount,
      timestamp: new Date(),
      notes: notes || ''
    });
    
    // Reset cash counts
    machine.cash.coins = { onePeso: 0, fivePeso: 0, tenPeso: 0, twentyPeso: 0 };
    machine.cash.bills = { twenty: 0, fifty: 0, hundred: 0, twoHundred: 0 };
    machine.cash.total = 0;
    machine.cash.lastUpdated = new Date();
    
    await machine.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('cash_collected', {
        collectedBy: collectedBy || 'Staff',
        amount: amount,
        timestamp: new Date()
      });
      io.emit('machine_data_updated', {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus,
        cash: machine.cash
      });
    }
    
    res.json({
      success: true,
      message: `Cash collected: ₱${amount.toFixed(2)}`,
      data: {
        amount: amount,
        collectedBy: collectedBy || 'Staff',
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error collecting cash:', error);
    res.status(500).json({ success: false, error: 'Failed to collect cash' });
  }
});

// ==================== GET CASH HISTORY ====================
router.get('/cash-history', protect, admin, async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine || !machine.cash?.history) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    res.json({
      success: true,
      data: machine.cash.history
    });
  } catch (error) {
    console.error('Error fetching cash history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cash history' });
  }
});

// ==================== CALIBRATE SCALE ====================
router.post('/calibrate/:scaleName', protect, staff, async (req, res) => {
  try {
    const { scaleName } = req.params;
    const { rawValue, calibratedValue } = req.body;
    
    let machine = await Machine.findOne();
    
    if (!machine) {
      machine = new Machine();
    }
    
    const validScales = ['storage1', 'storage2', 'dispense'];
    if (!validScales.includes(scaleName)) {
      return res.status(400).json({ success: false, error: 'Invalid scale name' });
    }
    
    // Initialize calibration if not exists
    if (!machine.calibration) machine.calibration = {};
    if (!machine.calibration[scaleName]) {
      machine.calibration[scaleName] = { unit: 'kg', status: 'Stable' };
    }
    
    machine.calibration[scaleName].rawValue = rawValue || 0;
    machine.calibration[scaleName].calibratedValue = calibratedValue || 0;
    machine.calibration[scaleName].status = 'Calibrated';
    machine.calibration[scaleName].lastCalibrated = new Date();
    
    await machine.save();
    
    res.json({
      success: true,
      message: `${scaleName} calibrated successfully`,
      data: machine.calibration[scaleName]
    });
  } catch (error) {
    console.error('Error calibrating scale:', error);
    res.status(500).json({ success: false, error: 'Failed to calibrate scale' });
  }
});

// ==================== ZERO SCALE ====================
router.post('/zero/:scaleName', protect, staff, async (req, res) => {
  try {
    const { scaleName } = req.params;
    
    let machine = await Machine.findOne();
    
    if (!machine) {
      machine = new Machine();
    }
    
    const validScales = ['storage1', 'storage2', 'dispense'];
    if (!validScales.includes(scaleName)) {
      return res.status(400).json({ success: false, error: 'Invalid scale name' });
    }
    
    // Initialize calibration if not exists
    if (!machine.calibration) machine.calibration = {};
    if (!machine.calibration[scaleName]) {
      machine.calibration[scaleName] = { unit: 'kg', status: 'Stable' };
    }
    
    machine.calibration[scaleName].rawValue = 0;
    machine.calibration[scaleName].calibratedValue = 0;
    machine.calibration[scaleName].status = 'Zeroed';
    machine.calibration[scaleName].lastZeroed = new Date();
    
    await machine.save();
    
    res.json({
      success: true,
      message: `${scaleName} zeroed successfully`,
      data: machine.calibration[scaleName]
    });
  } catch (error) {
    console.error('Error zeroing scale:', error);
    res.status(500).json({ success: false, error: 'Failed to zero scale' });
  }
});

// ==================== GET CALIBRATION STATUS ====================
router.get('/calibration', protect, admin, async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine || !machine.calibration) {
      return res.json({
        success: true,
        data: {
          storage1: { unit: 'kg', status: 'Stable' },
          storage2: { unit: 'kg', status: 'Stable' },
          dispense: { unit: 'kg', status: 'Stable' }
        }
      });
    }
    
    res.json({
      success: true,
      data: machine.calibration
    });
  } catch (error) {
    console.error('Error fetching calibration status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calibration status' });
  }
});

// ==================== GET CASH SUMMARY ====================
router.get('/cash-summary', protect, admin, async (req, res) => {
  try {
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine || !machine.cash) {
      return res.json({
        success: true,
        data: {
          coins: { onePeso: 0, fivePeso: 0, tenPeso: 0, twentyPeso: 0 },
          bills: { twenty: 0, fifty: 0, hundred: 0, twoHundred: 0 },
          total: 0
        }
      });
    }
    
    res.json({
      success: true,
      data: machine.cash
    });
  } catch (error) {
    console.error('Error fetching cash summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cash summary' });
  }
});

export default router;