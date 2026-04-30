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
        machineStatus: machine.machineStatus
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
      if (pricePerKg) machine.storage1.pricePerKg = pricePerKg;
    } else if (storageId === '2') {
      if (name) machine.storage2.name = name;
      if (pricePerKg) machine.storage2.pricePerKg = pricePerKg;
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
        machineStatus: machine.machineStatus
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
        lastUpdate: machine.machineStatus.lastUpdate
      }
    });
  } catch (error) {
    console.error('Error fetching machine stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;