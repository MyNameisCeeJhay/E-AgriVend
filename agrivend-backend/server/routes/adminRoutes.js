import express from 'express';
import User from '../models/User.js';
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

// ===== DASHBOARD ROUTE =====
router.get('/dashboard', protect, admin, async (req, res) => {
  console.log('👑 GET /api/admin/dashboard - by:', req.user?.email);
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalTransactions = await Transaction.countDocuments();
    const pendingReturns = await Return.countDocuments({ status: 'PENDING' });
    const unreadMessages = await Message.countDocuments({ status: 'unread' });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTransactions,
        pendingReturns,
        unreadMessages
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
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

// ===== DAILY REPORT ROUTE =====
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
    
    // Group by hour for chart
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

// ===== WEEKLY REPORT ROUTE =====
router.get('/reports/weekly', protect, admin, async (req, res) => {
  console.log('📆 GET /api/admin/reports/weekly - by:', req.user?.email);
  try {
    const { week, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentWeek = week || Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    
    // Calculate start and end of week
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
    
    // Group by day of week
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

// ===== MONTHLY REPORT ROUTE =====
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
    
    // Group by week of month
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

// ===== CUSTOM DATE RANGE REPORT ROUTE =====
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
    
    // Group by date
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

// ===== USER MANAGEMENT ROUTES =====

// Get all users with pagination and filters
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

    // Build query
    let query = {};
    
    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by role
    if (role !== 'all') {
      query.role = role;
    }
    
    // Filter by status
    if (status !== 'all') {
      query.isActive = status === 'active';
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    // Get user statistics
    const stats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ isActive: true }),
      inactive: await User.countDocuments({ isActive: false }),
      admins: await User.countDocuments({ role: 'admin' }),
      customers: await User.countDocuments({ role: 'customer' }),
      newToday: await User.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
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

    // Get user statistics
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
        ...user.toJSON(),
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

// Create new user (admin only)
router.post('/users', protect, admin, async (req, res) => {
  console.log('➕ POST /api/admin/users - Creating new user by:', req.user?.email);
  try {
    const { email, password, firstName, lastName, phone, address, role, isActive } = req.body;

    console.log('Request body:', { email, firstName, lastName, role, isActive });

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, first name, and last name are required' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: role || 'customer',
      isActive: isActive !== undefined ? isActive : true
    });

    await user.save();

    console.log('✅ User created successfully:', user.email);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('user_created', {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      });
    }

    res.status(201).json({
      success: true,
      data: user.toJSON()
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

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already in use' 
        });
      }
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    console.log('✅ User updated successfully:', user.email);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`
      });
    }

    res.json({
      success: true,
      data: user.toJSON()
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

    // Prevent deleting your own account
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }

    await user.deleteOne();

    console.log('✅ User deleted successfully:', user.email);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', {
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

// Toggle user active status (activate/deactivate)
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

    // Prevent deactivating your own account
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot deactivate your own account' 
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    const action = user.isActive ? 'activated' : 'deactivated';

    console.log(`✅ User ${action}:`, user.email);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('user_status_changed', {
        userId: user._id,
        isActive: user.isActive,
        action
      });
    }

    res.json({
      success: true,
      data: user.toJSON(),
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

// Reset user password (admin only)
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

    // Prevent deleting your own account
    if (userIds.includes(req.user._id.toString())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }

    const result = await User.deleteMany({ _id: { $in: userIds } });

    console.log(`✅ ${result.deletedCount} users deleted`);

    res.json({
      success: true,
      message: `${result.deletedCount} users deleted successfully`
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

    // Prevent deactivating your own account
    if (!isActive && userIds.includes(req.user._id.toString())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot deactivate your own account' 
      });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { isActive }
    );

    console.log(`✅ ${result.modifiedCount} users updated`);

    res.json({
      success: true,
      message: `${result.modifiedCount} users updated successfully`
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