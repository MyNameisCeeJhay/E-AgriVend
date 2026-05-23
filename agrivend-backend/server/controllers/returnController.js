import Return from '../models/Return.js';
import { generateReturnId } from '../utils/generateId.js';
import fs from 'fs';

// @desc    Get returns
// @route   GET /api/returns
// @access  Private
export const getReturns = async (req, res) => {
  try {
    let query = {};
    
    // For non-admin users, show only their returns by email
    if (req.user.role !== 'admin') {
      query = {
        email: req.user.email
      };
    }

    const returns = await Return.find(query)
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

// @desc    Create return request (for logged-in users)
// @route   POST /api/returns
// @access  Private
export const createReturn = async (req, res) => {
  try {
    const {
      transactionId,
      riceType,
      quantityKg,
      amountPaid,
      returnReason,
      description,
      fullName,
      email
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
      fullName,
      email,
      riceType,
      quantityKg: parseFloat(quantityKg),
      amountPaid: parseFloat(amountPaid),
      returnReason,
      description: description || '',
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
    const { status, adminNotes, processedByName } = req.body;

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
    returnRequest.processedByName = processedByName || 'Admin';
    returnRequest.processedAt = new Date();

    await returnRequest.save();

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

// @desc    Get public refund status by transaction ID
// @route   GET /api/returns/public/:transactionId
// @access  Public
export const getPublicReturnStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const returnRequest = await Return.findOne({ transactionId: transactionId });
    
    if (!returnRequest) {
      return res.status(404).json({ 
        success: false,
        error: 'No refund request found for this transaction' 
      });
    }
    
    res.json({
      success: true,
      data: {
        status: returnRequest.status,
        returnId: returnRequest.returnId,
        createdAt: returnRequest.createdAt,
        processedAt: returnRequest.processedAt,
        adminNotes: returnRequest.adminNotes,
        processedByName: returnRequest.processedByName
      }
    });
  } catch (error) {
    console.error('Get Public Return Status Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};