import Return from '../models/Return.js';
import { generateReturnId } from '../utils/generateId.js';
import fs from 'fs';

// @desc    Get returns
// @route   GET /api/returns
// @access  Private
export const getReturns = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const returns = await Return.find(query)
      .populate('user', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: returns
    });

  } catch (error) {
    console.error('Get Returns Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Create return request
// @route   POST /api/returns
// @access  Private
export const createReturn = async (req, res) => {
  try {
    const {
      transactionId,
      riceType,
      quantityKg,
      amountPaid,
      returnReason
    } = req.body;

    // Validate required fields
    if (!transactionId || !riceType || !quantityKg || !amountPaid || !returnReason) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }

    // Generate return ID
    const returnId = generateReturnId();

    const returnData = {
      returnId,
      transactionId,
      user: req.user._id,
      riceType,
      quantityKg: parseFloat(quantityKg),
      amountPaid: parseFloat(amountPaid),
      returnReason,
      status: 'PENDING'
    };

    // Handle file upload
    if (req.file) {
      returnData.receiptFilename = req.file.filename;
      returnData.receiptPath = req.file.path;
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Receipt image is required' 
      });
    }

    const newReturn = await Return.create(returnData);
    await newReturn.populate('user', 'firstName lastName email');

    // Emit socket event for admin
    const io = req.app.get('io');
    if (io) {
      io.emit('new_return', newReturn);
    }

    res.status(201).json({
      success: true,
      data: newReturn
    });

  } catch (error) {
    console.error('Create Return Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Process return
// @route   PUT /api/returns/:returnId/process
// @access  Private (Admin only)
export const processReturn = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid status (APPROVED or REJECTED) is required' 
      });
    }

    const returnRequest = await Return.findOne({ returnId: req.params.returnId });

    if (!returnRequest) {
      return res.status(404).json({ 
        success: false,
        error: 'Return not found' 
      });
    }

    returnRequest.status = status;
    returnRequest.adminNotes = adminNotes || '';
    returnRequest.processedBy = req.user._id;
    returnRequest.processedAt = new Date();

    await returnRequest.save();
    await returnRequest.populate('user', 'firstName lastName email');
    await returnRequest.populate('processedBy', 'firstName lastName');

    // Emit socket event for customer
    const io = req.app.get('io');
    if (io) {
      io.emit('return_processed', returnRequest);
    }

    res.json({
      success: true,
      data: returnRequest
    });

  } catch (error) {
    console.error('Process Return Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};