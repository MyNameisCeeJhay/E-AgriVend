import express from 'express';
import SensorData from '../models/SensorData.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ===== ESP32 ENDPOINT (No auth required - Arduino posts data) =====
router.post('/update', async (req, res) => {
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
      machineStatus,
      container1Stock,
      container2Stock
    } = req.body;

    const sensorData = new SensorData({
      container1Level,
      container2Level,
      collectionBinWeight: collectionBinWeight || 0,
      batteryVoltage,
      batteryPercentage,
      temperature,
      humidity,
      doorStatus,
      machineStatus,
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
      if (container1Stock === 'LOW' || container1Stock === 'EMPTY') {
        alerts.push({ type: 'LOW_STOCK', container: 'Sinandomeng', level: container1Level });
      }
      if (container2Stock === 'LOW' || container2Stock === 'EMPTY') {
        alerts.push({ type: 'LOW_STOCK', container: 'Dinorado', level: container2Level });
      }
      if (batteryPercentage < 20) {
        alerts.push({ type: 'LOW_BATTERY', percentage: batteryPercentage });
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

// ===== GET CURRENT SENSOR DATA =====
router.get('/current', protect, async (req, res) => {
  try {
    const latestData = await SensorData.findOne().sort({ createdAt: -1 });
    
    if (!latestData) {
      // Return mock data for testing
      return res.json({
        success: true,
        data: {
          container1Level: 15.5,
          container2Level: 8.2,
          container1Stock: 'OK',
          container2Stock: 'LOW',
          batteryPercentage: 78.5,
          batteryVoltage: 12.4,
          temperature: 32.5,
          humidity: 65,
          doorStatus: 'CLOSED',
          machineStatus: 'ACTIVE',
          lastUpdate: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: latestData
    });
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET SENSOR HISTORY (Admin only) =====
router.get('/history', protect, admin, async (req, res) => {
  try {
    const { days = 7, limit = 100 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const history = await SensorData.find({
      createdAt: { $gte: cutoffDate }
    })
      .sort({ createdAt: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET SENSOR STATISTICS (Admin only) =====
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const total = await SensorData.countDocuments();
    const avgTemp = await SensorData.aggregate([
      { $group: { _id: null, avg: { $avg: "$temperature" } } }
    ]);
    const avgBattery = await SensorData.aggregate([
      { $group: { _id: null, avg: { $avg: "$batteryPercentage" } } }
    ]);
    const lowStockCount = await SensorData.countDocuments({
      $or: [
        { container1Stock: 'LOW' },
        { container2Stock: 'LOW' }
      ]
    });

    res.json({
      success: true,
      data: {
        totalReadings: total,
        averageTemperature: avgTemp[0]?.avg?.toFixed(1) || 0,
        averageBattery: avgBattery[0]?.avg?.toFixed(1) || 0,
        lowStockCount
      }
    });
  } catch (error) {
    console.error('Error fetching sensor stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;