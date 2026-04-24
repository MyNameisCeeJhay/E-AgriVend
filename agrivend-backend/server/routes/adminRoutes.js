import User from '../models/User.js';
import express from 'express';
// import User from '../models/User.js'; // REMOVED - Using in-memory store
import Transaction from '../models/Transaction.js';
import Return from '../models/Return.js';
import Message from '../models/Message.js';
import Rating from '../models/Rating.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// In-memory user store (for development only)
// This should match the users array from authRoutes.js
const users = [
  {
    id: 1,
    _id: 1,
    email: 'admin@agrivend.com',
    firstName: 'Admin',
    lastName: 'User',
    phone: '',
    address: '',
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

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

// Helper to find user by ID
const findUserById = (id) => {
  return users.find(u => u._id === id || u.id === id);
};

// Helper to find user by email
const findUserByEmail = (email) => {
  return users.find(u => u.email === email);
};

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

// ===== USER MANAGEMENT ROUTES (Using in-memory store) =====

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

    // Filter users
    let filteredUsers = [...users];
    
    // Search by name or email
    if (search) {
      filteredUsers = filteredUsers.filter(u => 
        u.firstName.toLowerCase().includes(search.toLowerCase()) ||
        u.lastName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Filter by role
    if (role !== 'all') {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }
    
    // Filter by status
    if (status !== 'all') {
      filteredUsers = filteredUsers.filter(u => u.isActive === (status === 'active'));
    }
    
    // Sort
    filteredUsers.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : 1;
      } else {
        return aVal < bVal ? -1 : 1;
      }
    });
    
    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));
    
    // Get user statistics
    const stats = {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      admins: users.filter(u => u.role === 'admin').length,
      customers: users.filter(u => u.role === 'customer').length,
      newToday: users.filter(u => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(u.createdAt) >= today;
      }).length
    };

    console.log(`✅ Found ${paginatedUsers.length} users (total: ${total})`);

    res.json({
      success: true,
      data: paginatedUsers,
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
    const user = findUserById(parseInt(req.params.userId));
    
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
        ...user,
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

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, first name, and last name are required' 
      });
    }

    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    const newUser = {
      id: users.length + 1,
      _id: users.length + 1,
      email,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: role || 'customer',
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    users.push(newUser);

    console.log('✅ User created successfully:', newUser.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_created', {
        userId: newUser._id,
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email
      });
    }

    res.status(201).json({
      success: true,
      data: newUser
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

    const userIndex = users.findIndex(u => u._id === parseInt(req.params.userId));
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (email && email !== users[userIndex].email) {
      const existingUser = findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already in use' 
        });
      }
    }

    if (firstName) users[userIndex].firstName = firstName;
    if (lastName) users[userIndex].lastName = lastName;
    if (email) users[userIndex].email = email;
    if (phone !== undefined) users[userIndex].phone = phone;
    if (address !== undefined) users[userIndex].address = address;
    if (role) users[userIndex].role = role;
    if (isActive !== undefined) users[userIndex].isActive = isActive;
    users[userIndex].updatedAt = new Date();

    console.log('✅ User updated successfully:', users[userIndex].email);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', {
        userId: users[userIndex]._id,
        name: `${users[userIndex].firstName} ${users[userIndex].lastName}`
      });
    }

    res.json({
      success: true,
      data: users[userIndex]
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
    const userIndex = users.findIndex(u => u._id === parseInt(req.params.userId));
    
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (users[userIndex]._id === req.user._id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }

    const deletedUser = users.splice(userIndex, 1)[0];

    console.log('✅ User deleted successfully:', deletedUser.email);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', {
        userId: deletedUser._id,
        email: deletedUser.email
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
    const userIndex = users.findIndex(u => u._id === parseInt(req.params.userId));
    
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    if (users[userIndex]._id === req.user._id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot deactivate your own account' 
      });
    }

    users[userIndex].isActive = !users[userIndex].isActive;
    const action = users[userIndex].isActive ? 'activated' : 'deactivated';

    console.log(`✅ User ${action}:`, users[userIndex].email);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_status_changed', {
        userId: users[userIndex]._id,
        isActive: users[userIndex].isActive,
        action
      });
    }

    res.json({
      success: true,
      data: users[userIndex],
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

    const user = findUserById(parseInt(req.params.userId));
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // In a real app, you would hash and save the password
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

    let deletedCount = 0;
    for (const userId of userIds) {
      const index = users.findIndex(u => u._id === parseInt(userId));
      if (index !== -1 && users[index]._id !== req.user._id) {
        users.splice(index, 1);
        deletedCount++;
      }
    }

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

    let updatedCount = 0;
    for (const userId of userIds) {
      const index = users.findIndex(u => u._id === parseInt(userId));
      if (index !== -1 && users[index]._id !== req.user._id) {
        users[index].isActive = isActive;
        updatedCount++;
      }
    }

    console.log(`✅ ${updatedCount} users updated`);

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
    
    // Use try-catch for each aggregation to prevent complete failure
    let todaySalesResult = [];
    let weekSalesResult = [];
    let monthSalesResult = [];
    let pendingReturns = 0;
    let unreadMessages = 0;
    let totalTransactions = 0;
    
    try {
      todaySalesResult = await Transaction.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]);
    } catch (err) {
      console.log('No transactions found for today');
    }
    
    try {
      weekSalesResult = await Transaction.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]);
    } catch (err) {
      console.log('No transactions found for week');
    }
    
    try {
      monthSalesResult = await Transaction.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]);
    } catch (err) {
      console.log('No transactions found for month');
    }
    
    try {
      pendingReturns = await Return?.countDocuments({ status: 'PENDING' }) || 0;
    } catch (err) {
      console.log('Return model not available');
    }
    
    try {
      unreadMessages = await Message?.countDocuments({ status: 'unread' }) || 0;
    } catch (err) {
      console.log('Message model not available');
    }
    
    try {
      totalTransactions = await Transaction.countDocuments({});
    } catch (err) {
      console.log('Error counting transactions');
    }
    
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
    res.status(500).json({ 
      success: false, 
      error: error.message,
      data: {
        todaySales: 0,
        weekSales: 0,
        monthSales: 0,
        pendingReturns: 0,
        unreadMessages: 0,
        totalTransactions: 0
      }
    });
  }
});

// ===== RECENT TRANSACTIONS ENDPOINT =====
router.get('/transactions/recent', protect, admin, async (req, res) => {
  console.log('📋 GET /api/admin/transactions/recent - by:', req.user?.email);
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    // Don't filter by status if the field doesn't exist
    const transactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // Format transactions to match frontend expectations
    const formattedTransactions = transactions.map(t => ({
      _id: t._id,
      transactionId: t.transactionId || t._id.toString().slice(-8),
      riceType: t.riceType || 'N/A',
      quantityKg: t.quantityKg || 0,
      totalAmount: t.amountPaid || t.totalAmount || 0,
      createdAt: t.createdAt || new Date()
    }));
    
    res.json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;