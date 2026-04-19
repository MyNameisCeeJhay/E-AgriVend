import SensorData from '../models/SensorData.js';

// @desc    Get current sensor data
// @route   GET /api/sensors/current
// @access  Private
export const getCurrentSensorData = async (req, res) => {
  try {
    let sensor = await SensorData.findOne().sort({ createdAt: -1 });

    if (!sensor) {
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
          solarPanelVoltage: 18.2,
          solarCharging: true,
          temperature: 32.5,
          doorStatus: 'CLOSED',
          machineStatus: 'ACTIVE',
          createdAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      data: sensor
    });

  } catch (error) {
    console.error('Get Sensor Data Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Get sensor history
// @route   GET /api/sensors/history
// @access  Private (Admin only)
export const getSensorHistory = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const sensors = await SensorData.find({
      createdAt: { $gte: cutoffDate }
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: sensors
    });

  } catch (error) {
    console.error('Get Sensor History Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Update sensor data (for Arduino)
// @route   POST /api/sensors/update
// @access  Public
export const updateSensorData = async (req, res) => {
  try {
    const {
      container1Level,
      container2Level,
      batteryVoltage,
      batteryPercentage,
      solarPanelVoltage,
      solarCharging,
      temperature,
      doorStatus,
      machineStatus
    } = req.body;

    // Determine stock status
    const container1Stock = 
      container1Level < 0.5 ? 'EMPTY' : 
      container1Level < 5 ? 'LOW' : 'OK';
    
    const container2Stock = 
      container2Level < 0.5 ? 'EMPTY' : 
      container2Level < 5 ? 'LOW' : 'OK';

    const sensorData = await SensorData.create({
      container1Level,
      container2Level,
      container1Stock,
      container2Stock,
      batteryVoltage,
      batteryPercentage,
      solarPanelVoltage,
      solarCharging,
      temperature,
      doorStatus,
      machineStatus
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('sensor_update', sensorData);

      // Check for alerts
      const alerts = [];
      if (container1Stock === 'LOW' || container1Stock === 'EMPTY') {
        alerts.push({ 
          type: 'LOW_STOCK', 
          container: 'Sinandomeng', 
          level: container1Level,
          status: container1Stock 
        });
      }
      if (container2Stock === 'LOW' || container2Stock === 'EMPTY') {
        alerts.push({ 
          type: 'LOW_STOCK', 
          container: 'Dinorado', 
          level: container2Level,
          status: container2Stock 
        });
      }
      if (batteryPercentage < 20) {
        alerts.push({ 
          type: 'LOW_BATTERY', 
          percentage: batteryPercentage,
          voltage: batteryVoltage 
        });
      }

      if (alerts.length > 0) {
        io.emit('alerts', alerts);
      }
    }

    res.json({
      success: true,
      data: sensorData
    });

  } catch (error) {
    console.error('Update Sensor Data Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};