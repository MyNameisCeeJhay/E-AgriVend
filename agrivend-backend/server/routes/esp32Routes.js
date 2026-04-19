import express from 'express';
import SensorData from '../models/SensorData.js';
import Transaction from '../models/Transaction.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ============ ESP32 ENDPOINTS (No authentication required) ============

// ESP32 sends sensor data (stock, battery, security)
router.post('/sensors/update', async (req, res) => {
  console.log('📡 ESP32 Sensor data received:', new Date().toISOString());
  
  try {
    const {
      container1Level,
      container2Level,
      collectionBinWeight,
      batteryVoltage,
      batteryPercentage,
      temperature,
      humidity,
      doorStatus,
      vibrationDetected,
      machineStatus,
      container1Stock,
      container2Stock,
      deviceId
    } = req.body;

    const sensorData = new SensorData({
      container1Level,
      container2Level,
      collectionBinWeight: collectionBinWeight || 0,
      batteryVoltage,
      batteryPercentage,
      temperature,
      humidity,
      doorStatus: doorStatus || 'CLOSED',
      machineStatus: machineStatus || 'ACTIVE',
      container1Stock: container1Stock || (container1Level >= 5 ? 'OK' : (container1Level > 0 ? 'LOW' : 'EMPTY')),
      container2Stock: container2Stock || (container2Level >= 5 ? 'OK' : (container2Level > 0 ? 'LOW' : 'EMPTY'))
    });

    await sensorData.save();

    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('sensor_update', sensorData);
      
      // Check for alerts
      const alerts = [];
      if (sensorData.container1Stock === 'LOW' || sensorData.container1Stock === 'EMPTY') {
        alerts.push({ type: 'LOW_STOCK', container: 'Sinandomeng', level: container1Level });
      }
      if (sensorData.container2Stock === 'LOW' || sensorData.container2Stock === 'EMPTY') {
        alerts.push({ type: 'LOW_STOCK', container: 'Dinorado', level: container2Level });
      }
      if (batteryPercentage < 20) {
        alerts.push({ type: 'LOW_BATTERY', percentage: batteryPercentage });
      }
      if (doorStatus === 'OPEN') {
        alerts.push({ type: 'SECURITY', message: 'Door is open!' });
      }
      if (vibrationDetected) {
        alerts.push({ type: 'SECURITY', message: 'Vibration detected!' });
      }
      
      if (alerts.length > 0) {
        io.emit('alerts', alerts);
      }
    }

    res.json({ success: true, message: 'Sensor data saved' });
  } catch (error) {
    console.error('❌ Error saving sensor data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ESP32 confirms transaction
router.post('/transaction/confirm', async (req, res) => {
  console.log('💰 ESP32 Transaction confirmation received');
  
  try {
    const {
      transactionId,
      riceType,
      quantityKg,
      amountPaid,
      status,
      deviceId
    } = req.body;
    
    // Save transaction
    const transaction = new Transaction({
      transactionId: transactionId || `TXN-${Date.now()}`,
      riceType: riceType || 'Sinandomeng',
      quantityKg: quantityKg || 0,
      pricePerKg: amountPaid / (quantityKg || 1),
      amountPaid: amountPaid || 0,
      paymentMethod: 'CASH',
      status: status === 'COMPLETED' ? 'COMPLETED' : 'FAILED'
    });
    
    await transaction.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('new_transaction', transaction);
    }
    
    res.json({ success: true, message: 'Transaction recorded' });
  } catch (error) {
    console.error('❌ Error recording transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ESP32 sends security alert
router.post('/security/alert', async (req, res) => {
  console.log('🚨 ESP32 Security alert received');
  
  try {
    const { alertType, deviceId, doorStatus, timestamp } = req.body;
    
    console.log(`⚠️ ALERT: ${alertType} from device ${deviceId}`);
    console.log(`   Door status: ${doorStatus}`);
    
    // Emit security alert to admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.emit('security_alert', {
        deviceId,
        alertType,
        doorStatus,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error handling security alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ ADMIN ENDPOINTS (Requires authentication) ============

// Get machine status (last known sensor data)
router.get('/machine/status', protect, admin, async (req, res) => {
  try {
    const latestData = await SensorData.findOne().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: latestData || null
    });
  } catch (error) {
    console.error('❌ Error fetching machine status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sensor history
router.get('/sensors/history', protect, admin, async (req, res) => {
  try {
    const { limit = 100, days = 7 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const history = await SensorData.find({
      createdAt: { $gte: cutoffDate }
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('❌ Error fetching sensor history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;