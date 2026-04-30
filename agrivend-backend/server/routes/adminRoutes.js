import User from '../models/User.js';
import express from 'express';
import Transaction from '../models/Transaction.js';
import Return from '../models/Return.js';
import Message from '../models/Message.js';
import Rating from '../models/Rating.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// Helper function to get date from ISO week
function getDateOfISOWeek(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

// ===== DASHBOARD STATS =====
router.get('/dashboard/stats', protect, admin, async (req, res) => {
  console.log('📊 GET /api/admin/dashboard/stats - by:', req.user?.email);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const [todaySalesResult, weekSalesResult, monthSalesResult, pendingReturns, unreadMessages, totalTransactions] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: today }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: weekStart }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: monthStart }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Return.countDocuments({ status: 'PENDING' }),
      Message.countDocuments({ status: 'unread' }),
      Transaction.countDocuments({ status: 'COMPLETED' })
    ]);
    
    res.json({
      success: true,
      data: {
        todaySales: todaySalesResult[0]?.total || 0,
        weekSales: weekSalesResult[0]?.total || 0,
        monthSales: monthSalesResult[0]?.total || 0,
        pendingReturns: pendingReturns,
        unreadMessages: unreadMessages,
        totalTransactions: totalTransactions
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== RECENT TRANSACTIONS ENDPOINT =====
router.get('/transactions/recent', protect, admin, async (req, res) => {
  console.log('📋 GET /api/admin/transactions/recent - by:', req.user?.email);
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const transactions = await Transaction.find({ status: 'COMPLETED' })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    const formattedTransactions = transactions.map(t => ({
      _id: t._id,
      transactionId: t.transactionId,
      riceType: t.riceType,
      quantityKg: t.quantityKg,
      totalAmount: t.amountPaid,
      createdAt: t.createdAt
    }));
    
    res.json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== TRANSACTION STATS ROUTE =====
router.get('/transactions/stats', protect, admin, async (req, res) => {
  console.log('📊 GET /api/admin/transactions/stats - by:', req.user?.email);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    monthAgo.setHours(0, 0, 0, 0);
    
    const [todaySales, weekSales, monthSales, totalSales] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: today }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: weekAgo }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: monthAgo }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Transaction.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        daily: todaySales[0]?.total || 0,
        weekly: weekSales[0]?.total || 0,
        monthly: monthSales[0]?.total || 0,
        total: totalSales[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// ===== REPORT ROUTES =====
router.get('/reports/daily', protect, admin, async (req, res) => {
  console.log('📅 GET /api/admin/reports/daily - by:', req.user?.email);
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'COMPLETED'
    }).sort({ createdAt: -1 });
    
    const totalSales = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }
    
    transactions.forEach(t => {
      const hour = new Date(t.createdAt).getHours();
      hourlyData[hour] += t.amountPaid;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalTransactions: transactions.length,
          totalSales,
          totalQuantity,
          averageOrderValue: transactions.length > 0 ? totalSales / transactions.length : 0
        },
        transactions,
        chartData: Object.entries(hourlyData).map(([hour, sales]) => ({
          label: `${hour}:00`,
          sales
        }))
      }
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.get('/reports/weekly', protect, admin, async (req, res) => {
  console.log('📆 GET /api/admin/reports/weekly - by:', req.user?.email);
  try {
    const { week, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentWeek = week || Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    
    const startDate = getDateOfISOWeek(parseInt(currentWeek), parseInt(currentYear));
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'COMPLETED'
    }).sort({ createdAt: -1 });
    
    const totalSales = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyData = {};
    dayNames.forEach(day => { dailyData[day] = 0; });
    
    transactions.forEach(t => {
      const day = dayNames[new Date(t.createdAt).getDay()];
      dailyData[day] += t.amountPaid;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalTransactions: transactions.length,
          totalSales,
          totalQuantity,
          averageOrderValue: transactions.length > 0 ? totalSales / transactions.length : 0
        },
        transactions,
        chartData: Object.entries(dailyData).map(([day, sales]) => ({
          label: day.slice(0, 3),
          sales
        }))
      }
    });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.get('/reports/monthly', protect, admin, async (req, res) => {
  console.log('📊 GET /api/admin/reports/monthly - by:', req.user?.email);
  try {
    const { month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(currentYear, currentMonth, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const transactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'COMPLETED'
    }).sort({ createdAt: -1 });
    
    const totalSales = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    const weeklyData = {
      'Week 1': 0,
      'Week 2': 0,
      'Week 3': 0,
      'Week 4': 0,
      'Week 5': 0
    };
    
    transactions.forEach(t => {
      const day = new Date(t.createdAt).getDate();
      let week = 'Week 1';
      if (day <= 7) week = 'Week 1';
      else if (day <= 14) week = 'Week 2';
      else if (day <= 21) week = 'Week 3';
      else if (day <= 28) week = 'Week 4';
      else week = 'Week 5';
      
      weeklyData[week] += t.amountPaid;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalTransactions: transactions.length,
          totalSales,
          totalQuantity,
          averageOrderValue: transactions.length > 0 ? totalSales / transactions.length : 0
        },
        transactions,
        chartData: Object.entries(weeklyData).map(([week, sales]) => ({
          label: week,
          sales
        }))
      }
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.get('/reports/custom', protect, admin, async (req, res) => {
  console.log('📅 GET /api/admin/reports/custom - by:', req.user?.email);
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start date and end date are required' 
      });
    }
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const transactions = await Transaction.find({
      createdAt: { $gte: start, $lte: end },
      status: 'COMPLETED'
    }).sort({ createdAt: -1 });
    
    const totalSales = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    const dailyData = {};
    transactions.forEach(t => {
      const dateKey = new Date(t.createdAt).toLocaleDateString('en-US');
      dailyData[dateKey] = (dailyData[dateKey] || 0) + t.amountPaid;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalTransactions: transactions.length,
          totalSales,
          totalQuantity,
          averageOrderValue: transactions.length > 0 ? totalSales / transactions.length : 0,
          dateRange: { startDate, endDate }
        },
        transactions,
        chartData: Object.entries(dailyData).map(([date, sales]) => ({
          label: date,
          sales
        }))
      }
    });
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

// ============================================
// USER MANAGEMENT ROUTES (Staff Management) - Updated with MongoDB
// ============================================

// Get all users with pagination and filters (Supports role='staff')
router.get('/users', protect, admin, async (req, res) => {
  console.log('👥 GET /api/admin/users - by:', req.user?.email);
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      role = 'all', 
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('Query params:', { page, limit, search, role, status, sortBy, sortOrder });

    let query = {};
    
    // Filter by role - IMPORTANT: Use 'staff' not 'admin' for staff management
    if (role === 'staff') {
      query.role = 'staff';
    } else if (role === 'admin') {
      query.role = 'admin';
    } else if (role === 'customer') {
      query.role = 'customer';
    }
    // If role === 'all', don't add role filter
    
    // Filter by status
    if (status !== 'all') {
      query.isActive = status === 'active';
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Sort order
    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const users = await User.find(query)
      .select('-password')
      .sort(sortOption)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    // Calculate stats based on role filter
    let statsQuery = {};
    if (role === 'staff') {
      statsQuery.role = 'staff';
    } else if (role === 'admin') {
      statsQuery.role = 'admin';
    }
    // For 'all', statsQuery is empty
    
    const totalStats = await User.countDocuments(statsQuery);
    const activeStats = await User.countDocuments({ ...statsQuery, isActive: true });
    const inactiveStats = await User.countDocuments({ ...statsQuery, isActive: false });
    const newTodayStats = await User.countDocuments({
      ...statsQuery,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    const stats = {
      total: totalStats,
      active: activeStats,
      inactive: inactiveStats,
      admins: await User.countDocuments({ role: 'admin' }),
      customers: await User.countDocuments({ role: 'customer' }),
      newToday: newTodayStats
    };

    console.log(`✅ Found ${users.length} users (total: ${total})`);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Get single user details
router.get('/users/:userId', protect, admin, async (req, res) => {
  console.log('👤 GET /api/admin/users/:userId - by:', req.user?.email);
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Get user statistics from transactions
    const transactionCount = await Transaction.countDocuments({ user: user._id });
    const totalSpent = await Transaction.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);
    
    const returnCount = await Return.countDocuments({ user: user._id });
    const messageCount = await Message.countDocuments({ user: user._id });
    const ratingCount = await Rating.countDocuments({ user: user._id });

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        stats: {
          transactionCount,
          totalSpent: totalSpent[0]?.total || 0,
          returnCount,
          messageCount,
          ratingCount
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Create new user (staff account)
router.post('/users', protect, admin, async (req, res) => {
  console.log('➕ POST /api/admin/users - Creating new user by:', req.user?.email);
  try {
    const { email, password, firstName, lastName, phone, address, role, isActive } = req.body;

    console.log('Request body:', { email, firstName, lastName, role, isActive });

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, first name, and last name are required' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: role || 'staff',
      isActive: isActive !== undefined ? isActive : true
    });

    await newUser.save();

    console.log('✅ User created successfully:', newUser.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_created', {
        userId: newUser._id,
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: newUser.isActive
      }
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Update user
router.put('/users/:userId', protect, admin, async (req, res) => {
  console.log('✏️ PUT /api/admin/users/:userId - Updating user by:', req.user?.email);
  try {
    const { firstName, lastName, email, phone, address, role, isActive } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already in use' 
        });
      }
      user.email = email;
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    console.log('✅ User updated successfully:', user.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_updated', {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Delete user
router.delete('/users/:userId', protect, admin, async (req, res) => {
  console.log('🗑️ DELETE /api/admin/users/:userId - Deleting user by:', req.user?.email);
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }

    await User.findByIdAndDelete(req.params.userId);

    console.log('✅ User deleted successfully:', user.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_deleted', {
        userId: user._id,
        email: user.email
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Toggle user active status
router.patch('/users/:userId/toggle-status', protect, admin, async (req, res) => {
  console.log('🔄 PATCH /api/admin/users/:userId/toggle-status - by:', req.user?.email);
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot modify your own account status' 
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    const action = user.isActive ? 'activated' : 'deactivated';
    console.log(`✅ User ${action}:`, user.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_status_changed', {
        userId: user._id,
        isActive: user.isActive,
        action
      });
    }

    res.json({
      success: true,
      data: user,
      message: `User ${action} successfully`
    });
  } catch (error) {
    console.error('❌ Error toggling user status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Reset user password
router.post('/users/:userId/reset-password', protect, admin, async (req, res) => {
  console.log('🔑 POST /api/admin/users/:userId/reset-password - by:', req.user?.email);
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    user.password = newPassword;
    await user.save();

    console.log('✅ Password reset for user:', user.email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Bulk delete users
router.post('/users/bulk/delete', protect, admin, async (req, res) => {
  console.log('🗑️ POST /api/admin/users/bulk/delete - Bulk delete by:', req.user?.email);
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    const filteredIds = userIds.filter(id => id !== req.user._id.toString());
    const deletedCount = filteredIds.length;

    await User.deleteMany({ _id: { $in: filteredIds } });

    console.log(`✅ ${deletedCount} users deleted`);

    res.json({
      success: true,
      message: `${deletedCount} users deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error bulk deleting users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Bulk update user status
router.post('/users/bulk/status', protect, admin, async (req, res) => {
  console.log('🔄 POST /api/admin/users/bulk/status - Bulk status update by:', req.user?.email);
  try {
    const { userIds, isActive } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'isActive status is required' 
      });
    }

    const filteredIds = userIds.filter(id => id !== req.user._id.toString());
    const updatedCount = filteredIds.length;

    await User.updateMany(
      { _id: { $in: filteredIds } },
      { $set: { isActive: isActive } }
    );

    console.log(`✅ ${updatedCount} users updated to ${isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      message: `${updatedCount} users updated successfully`
    });
  } catch (error) {
    console.error('❌ Error bulk updating users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

router.get('/users', protect, admin, async (req, res) => {
  console.log('👥 GET /api/admin/users - by:', req.user?.email);
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      role = 'all', 
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('Query params:', { page, limit, search, role, status, sortBy, sortOrder });

    let query = {};
    
    // Filter by role - IMPORTANT: Use 'staff' not 'admin' for staff management
    if (role === 'staff') {
      query.role = 'staff';
    } else if (role === 'admin') {
      query.role = 'admin';
    } else if (role === 'customer') {
      query.role = 'customer';
    }
    // If role === 'all', don't add role filter
    
    // Filter by status
    if (status !== 'all') {
      query.isActive = status === 'active';
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Sort order
    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const users = await User.find(query)
      .select('-password')
      .sort(sortOption)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    // Calculate stats based on role filter
    let statsQuery = {};
    if (role === 'staff') {
      statsQuery.role = 'staff';
    } else if (role === 'admin') {
      statsQuery.role = 'admin';
    }
    // For 'all', statsQuery is empty
    
    const totalStats = await User.countDocuments(statsQuery);
    const activeStats = await User.countDocuments({ ...statsQuery, isActive: true });
    const inactiveStats = await User.countDocuments({ ...statsQuery, isActive: false });
    const newTodayStats = await User.countDocuments({
      ...statsQuery,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    const stats = {
      total: totalStats,
      active: activeStats,
      inactive: inactiveStats,
      admins: await User.countDocuments({ role: 'admin' }),
      customers: await User.countDocuments({ role: 'customer' }),
      newToday: newTodayStats
    };

    console.log(`✅ Found ${users.length} users (total: ${total})`);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Get single user details
router.get('/users/:userId', protect, admin, async (req, res) => {
  console.log('👤 GET /api/admin/users/:userId - by:', req.user?.email);
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Get user statistics from transactions
    const transactionCount = await Transaction.countDocuments({ user: user._id });
    const totalSpent = await Transaction.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);
    
    const returnCount = await Return.countDocuments({ user: user._id });
    const messageCount = await Message.countDocuments({ user: user._id });
    const ratingCount = await Rating.countDocuments({ user: user._id });

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        stats: {
          transactionCount,
          totalSpent: totalSpent[0]?.total || 0,
          returnCount,
          messageCount,
          ratingCount
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Create new user (staff account)
router.post('/users', protect, admin, async (req, res) => {
  console.log('➕ POST /api/admin/users - Creating new user by:', req.user?.email);
  try {
    const { email, password, firstName, lastName, phone, address, role, isActive } = req.body;

    console.log('Request body:', { email, firstName, lastName, role, isActive });

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, first name, and last name are required' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: role || 'staff',
      isActive: isActive !== undefined ? isActive : true
    });

    await newUser.save();

    console.log('✅ User created successfully:', newUser.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_created', {
        userId: newUser._id,
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: newUser.isActive
      }
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Update user
router.put('/users/:userId', protect, admin, async (req, res) => {
  console.log('✏️ PUT /api/admin/users/:userId - Updating user by:', req.user?.email);
  try {
    const { firstName, lastName, email, phone, address, role, isActive } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already in use' 
        });
      }
      user.email = email;
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    console.log('✅ User updated successfully:', user.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_updated', {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Delete user
router.delete('/users/:userId', protect, admin, async (req, res) => {
  console.log('🗑️ DELETE /api/admin/users/:userId - Deleting user by:', req.user?.email);
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }

    await User.findByIdAndDelete(req.params.userId);

    console.log('✅ User deleted successfully:', user.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_deleted', {
        userId: user._id,
        email: user.email
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Toggle user active status
router.patch('/users/:userId/toggle-status', protect, admin, async (req, res) => {
  console.log('🔄 PATCH /api/admin/users/:userId/toggle-status - by:', req.user?.email);
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot modify your own account status' 
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    const action = user.isActive ? 'activated' : 'deactivated';
    console.log(`✅ User ${action}:`, user.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('staff_status_changed', {
        userId: user._id,
        isActive: user.isActive,
        action
      });
    }

    res.json({
      success: true,
      data: user,
      message: `User ${action} successfully`
    });
  } catch (error) {
    console.error('❌ Error toggling user status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Reset user password
router.post('/users/:userId/reset-password', protect, admin, async (req, res) => {
  console.log('🔑 POST /api/admin/users/:userId/reset-password - by:', req.user?.email);
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    user.password = newPassword;
    await user.save();

    console.log('✅ Password reset for user:', user.email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Bulk delete users
router.post('/users/bulk/delete', protect, admin, async (req, res) => {
  console.log('🗑️ POST /api/admin/users/bulk/delete - Bulk delete by:', req.user?.email);
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    const filteredIds = userIds.filter(id => id !== req.user._id.toString());
    const deletedCount = filteredIds.length;

    await User.deleteMany({ _id: { $in: filteredIds } });

    console.log(`✅ ${deletedCount} users deleted`);

    res.json({
      success: true,
      message: `${deletedCount} users deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error bulk deleting users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Bulk update user status
router.post('/users/bulk/status', protect, admin, async (req, res) => {
  console.log('🔄 POST /api/admin/users/bulk/status - Bulk status update by:', req.user?.email);
  try {
    const { userIds, isActive } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'isActive status is required' 
      });
    }

    const filteredIds = userIds.filter(id => id !== req.user._id.toString());
    const updatedCount = filteredIds.length;

    await User.updateMany(
      { _id: { $in: filteredIds } },
      { $set: { isActive: isActive } }
    );

    console.log(`✅ ${updatedCount} users updated to ${isActive ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      message: `${updatedCount} users updated successfully`
    });
  } catch (error) {
    console.error('❌ Error bulk updating users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

export default router;