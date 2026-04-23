import express from 'express';
import Machine from '../models/Machine.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ==================== GET MACHINE DATA ====================
router.get('/data', protect, admin, async (req, res) => {
  try {
    // Get the latest machine record
    let machine = await Machine.findOne().sort({ createdAt: -1 });
    
    // If no machine data exists, create default
    if (!machine) {
      machine = await Machine.create({
        storage1: { currentWeight: 0, percentage: 0, status: 'Normal' },
        storage2: { currentWeight: 0, percentage: 0, status: 'Normal' },
        battery: { percentage: 100, voltage: 12.6, isCharging: true },
        machineStatus: { isOnline: true, temperature: 25, doorStatus: 'Closed', securityStatus: 'Safe' }
      });
    }
    
    // Get product names from products collection
    if (machine.storage1.productId) {
      const product = await Product.findById(machine.storage1.productId);
      if (product) {
        machine.storage1.name = product.name;
        machine.storage1.pricePerKg = product.pricePerKg;
      }
    }
    
    if (machine.storage2.productId) {
      const product = await Product.findById(machine.storage2.productId);
      if (product) {
        machine.storage2.name = product.name;
        machine.storage2.pricePerKg = product.pricePerKg;
      }
    }
    
    res.json({
      success: true,
      data: {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus
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
    const { storage1Weight, storage2Weight, batteryPercentage, batteryVoltage, temperature, doorStatus } = req.body;
    
    let machine = await Machine.findOne().sort({ createdAt: -1 });
    
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
      machine.battery.lastUpdated = new Date();
    }
    
    // Update machine status
    if (temperature !== undefined) machine.machineStatus.temperature = temperature;
    if (doorStatus !== undefined) machine.machineStatus.doorStatus = doorStatus;
    machine.machineStatus.lastUpdate = new Date();
    
    // Add to history
    machine.sensorHistory.push({
      storage1Weight: machine.storage1.currentWeight,
      storage2Weight: machine.storage2.currentWeight,
      batteryPercentage: machine.battery.percentage,
      temperature: machine.machineStatus.temperature,
      timestamp: new Date()
    });
    
    // Keep only last 100 history records
    if (machine.sensorHistory.length > 100) {
      machine.sensorHistory = machine.sensorHistory.slice(-100);
    }
    
    await machine.save();
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('machine_data_updated', {
        storage1: machine.storage1,
        storage2: machine.storage2,
        battery: machine.battery,
        machineStatus: machine.machineStatus
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
        machineStatus: machine.machineStatus
      }
    });
  } catch (error) {
    console.error('Error updating machine data:', error);
    res.status(500).json({ success: false, error: 'Failed to update machine data' });
  }
});

// ==================== REFILL STORAGE ====================
router.post('/refill', protect, admin, async (req, res) => {
  try {
    const { storageId, amount } = req.body;
    
    let machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine) {
      machine = new Machine();
    }
    
    if (storageId === 1) {
      machine.storage1.currentWeight = amount;
      machine.storage1.percentage = (amount / machine.storage1.maxCapacity) * 100;
      machine.storage1.status = amount < 5 ? 'Critical' : amount < 10 ? 'Low' : 'Normal';
      machine.storage1.isLow = amount < 10;
      machine.storage1.lastUpdated = new Date();
    } else if (storageId === 2) {
      machine.storage2.currentWeight = amount;
      machine.storage2.percentage = (amount / machine.storage2.maxCapacity) * 100;
      machine.storage2.status = amount < 5 ? 'Critical' : amount < 10 ? 'Low' : 'Normal';
      machine.storage2.isLow = amount < 10;
      machine.storage2.lastUpdated = new Date();
    }
    
    await machine.save();
    
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
router.put('/product/:storageId', protect, admin, async (req, res) => {
  try {
    const { storageId } = req.params;
    const { name, pricePerKg, productId } = req.body;
    
    let machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine) {
      machine = new Machine();
    }
    
    if (storageId === '1') {
      if (name) machine.storage1.name = name;
      if (pricePerKg) machine.storage1.pricePerKg = pricePerKg;
      if (productId) machine.storage1.productId = productId;
    } else {
      if (name) machine.storage2.name = name;
      if (pricePerKg) machine.storage2.pricePerKg = pricePerKg;
      if (productId) machine.storage2.productId = productId;
    }
    
    await machine.save();
    
    res.json({
      success: true,
      message: `Product updated successfully`,
      data: storageId === '1' ? machine.storage1 : machine.storage2
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// ==================== GET MACHINE HISTORY ====================
router.get('/history', protect, admin, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const machine = await Machine.findOne().sort({ createdAt: -1 });
    
    if (!machine) {
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
          totalStock: 0,
          batteryHealth: 'Good',
          avgTemperature: 25,
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
        lastUpdate: machine.machineStatus.lastUpdate
      }
    });
  } catch (error) {
    console.error('Error fetching machine stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;