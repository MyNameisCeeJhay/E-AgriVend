import SensorData from '../models/SensorData.js';
import Transaction from '../models/Transaction.js';
import Return from '../models/Return.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
export const getAdminDashboard = async (req, res) => {
  try {
    // Get current sensor data
    const sensorData = await SensorData.findOne().sort({ createdAt: -1 });

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's transactions
    const todayTransactions = await Transaction.find({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const todaySales = todayTransactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const todayKg = todayTransactions.reduce((sum, t) => sum + t.quantityKg, 0);

    // Pending returns
    const pendingReturns = await Return.countDocuments({ status: 'PENDING' });

    // Unread messages
    const unreadMessages = await Message.countDocuments({ status: 'UNREAD' });

    // Low stock alerts
    const lowStock = [];
    if (sensorData) {
      if (sensorData.container1Stock === 'LOW' || sensorData.container1Stock === 'EMPTY') {
        lowStock.push({ 
          container: 'Sinandomeng', 
          level: sensorData.container1Level,
          status: sensorData.container1Stock 
        });
      }
      if (sensorData.container2Stock === 'LOW' || sensorData.container2Stock === 'EMPTY') {
        lowStock.push({ 
          container: 'Dinorado', 
          level: sensorData.container2Level,
          status: sensorData.container2Stock 
        });
      }
    }

    // Recent transactions
    const recentTransactions = await Transaction.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    // Recent returns
    const recentReturns = await Return.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    // User count
    const totalUsers = await User.countDocuments({ role: 'customer' });

    res.json({
      success: true,
      data: {
        sensorData: sensorData || null,
        todaySales,
        todayKg,
        todayTransactionsCount: todayTransactions.length,
        pendingReturns,
        unreadMessages,
        lowStockAlerts: lowStock,
        recentTransactions,
        recentReturns,
        totalUsers
      }
    });

  } catch (error) {
    console.error('Get Admin Dashboard Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:userId
// @access  Private (Admin only)
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { firstName, lastName, email, phone, address, role, isActive } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.json({
      success: true,
      data: user.toJSON()
    });

  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};