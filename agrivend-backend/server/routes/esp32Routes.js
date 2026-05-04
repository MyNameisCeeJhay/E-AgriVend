import express from 'express';
import Transaction from '../models/Transaction.js';
import SensorData from '../models/SensorData.js';

const router = express.Router();

// ============================================
// PUBLIC ENDPOINTS (No authentication required)
// ============================================

// Get latest sensor data for public dashboard
router.get('/public/latest', async (req, res) => {
  try {
    const latestData = await SensorData.findOne().sort({ createdAt: -1 });
    
    if (!latestData) {
      return res.json({
        success: true,
        data: {
          container1Level: 0,
          container2Level: 0,
          totalStock: 0,
          batteryPercentage: 100,
          doorStatus: 'CLOSED',
          machineStatus: 'ACTIVE',
          lastUpdate: null
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        container1Level: latestData.container1Level,
        container2Level: latestData.container2Level,
        totalStock: latestData.container1Level + latestData.container2Level,
        batteryPercentage: latestData.batteryPercentage,
        doorStatus: latestData.doorStatus,
        machineStatus: latestData.machineStatus,
        container1Stock: latestData.container1Stock,
        container2Stock: latestData.container2Stock,
        lastUpdate: latestData.updatedAt || latestData.createdAt
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
    const latestData = await SensorData.findOne().sort({ createdAt: -1 });
    const maxLevel = 20;
    
    if (!latestData) {
      return res.json({
        success: true,
        data: { level: 0, maxLevel, percentage: 0, fillLevel: '0%', status: 'OK', remainingKg: 0 }
      });
    }
    
    const level = id === '1' ? latestData.container1Level : latestData.container2Level;
    const percentage = (level / maxLevel) * 100;
    const stockStatus = id === '1' ? latestData.container1Stock : latestData.container2Stock;
    
    res.json({
      success: true,
      data: {
        level: level,
        maxLevel: maxLevel,
        percentage: percentage,
        fillLevel: percentage.toFixed(1) + '%',
        status: stockStatus,
        remainingKg: level
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
    const latestData = await SensorData.findOne().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        totalStock: latestData ? (latestData.container1Level + latestData.container2Level) : 0,
        batteryPercentage: latestData?.batteryPercentage || 100,
        doorStatus: latestData?.doorStatus || 'CLOSED',
        machineStatus: latestData?.machineStatus || 'ACTIVE'
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
  console.log('📡 ESP32 Sensor data received');
  
  try {
    const {
      container1Level, container2Level, collectionBinWeight,
      batteryVoltage, batteryPercentage, temperature, humidity,
      doorStatus, vibrationDetected, machineStatus,
      container1Stock, container2Stock, deviceId
    } = req.body;

    const sensorData = new SensorData({
      container1Level: container1Level || 0,
      container2Level: container2Level || 0,
      collectionBinWeight: collectionBinWeight || 0,
      batteryVoltage: batteryVoltage || 12.5,
      batteryPercentage: batteryPercentage || 100,
      temperature: temperature || 25,
      humidity: humidity || 60,
      doorStatus: doorStatus || 'CLOSED',
      vibrationDetected: vibrationDetected || false,
      machineStatus: machineStatus || 'ACTIVE',
      container1Stock: container1Stock || (container1Level >= 5 ? 'OK' : (container1Level > 0 ? 'LOW' : 'EMPTY')),
      container2Stock: container2Stock || (container2Level >= 5 ? 'OK' : (container2Level > 0 ? 'LOW' : 'EMPTY')),
      deviceId: deviceId || 'AGRIVEND_001'
    });

    await sensorData.save();
    console.log(`✅ Saved: Stock1=${container1Level}kg, Stock2=${container2Level}kg`);

    const io = req.app.get('io');
    if (io) io.emit('sensor_update', sensorData);

    res.json({ success: true, message: 'Sensor data saved' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/transaction/confirm', async (req, res) => {
  console.log('📝 ESP32 Transaction received:', req.body);
  
  try {
    const { transactionId, riceType, quantityKg, amountPaid, status } = req.body;
    
    // Validate required fields
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
    
    // Map rice type to product name
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
    
    // Create transaction WITHOUT user and recordedBy
    const transaction = new Transaction({
      transactionId: transactionId || `TXN-${Date.now()}`,
      productName: productName,
      quantityKg: parseFloat(quantityKg),
      pricePerKg: pricePerKg,
      amountPaid: parseFloat(amountPaid),
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      source: 'machine',  // Mark as machine transaction
      notes: `Auto-recorded by vending machine`
    });
    
    await transaction.save();
    
    console.log(`✅ Transaction saved: ${transaction.transactionId}`);
    console.log(`   Product: ${productName}, ${quantityKg}kg, PHP ${amountPaid}`);
    
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

router.post('/security/alert', async (req, res) => {
  console.log('🚨 Security alert:', req.body.alertType);
  
  const io = req.app.get('io');
  if (io) io.emit('security_alert', req.body);
  
  res.json({ success: true });
});

// ============================================
// ADMIN PROTECTED ENDPOINTS
// ============================================

router.get('/machine/status', async (req, res) => {
  try {
    const latestData = await SensorData.findOne().sort({ createdAt: -1 });
    res.json({ success: true, data: latestData || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sensors/history', async (req, res) => {
  try {
    const { limit = 100, days = 7 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const history = await SensorData.find({
      createdAt: { $gte: cutoffDate }
    }).sort({ createdAt: -1 }).limit(parseInt(limit));
    
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;