import express from 'express';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Return from '../models/Return.js';
import Message from '../models/Message.js';
import Rating from '../models/Rating.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

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