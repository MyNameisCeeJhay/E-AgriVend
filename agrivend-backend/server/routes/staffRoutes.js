import express from 'express';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Staff products storage (in-memory cache - you can replace with database collection)
let staffProducts = [
  { id: 1, name: 'Sinandomeng Rice', price: 54.00, isArchived: false },
  { id: 2, name: 'Dinorado Rice', price: 65.00, isArchived: false },
  { id: 3, name: 'Jasmine Rice', price: 70.00, isArchived: false },
  { id: 4, name: 'Premium Rice', price: 85.00, isArchived: false },
  { id: 5, name: 'Brown Rice', price: 60.00, isArchived: false },
  { id: 6, name: 'Glutinous Rice', price: 75.00, isArchived: false },
  { id: 7, name: 'Organic Rice', price: 90.00, isArchived: false }
];

// Get all staff products
router.get('/products', protect, async (req, res) => {
  try {
    // Only staff and admin can access
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    res.json({
      success: true,
      data: staffProducts
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save/Update all staff products
router.post('/products', protect, async (req, res) => {
  try {
    // Only staff and admin can modify
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid products data' 
      });
    }
    
    staffProducts = products;
    
    // Emit socket event for real-time updates across all staff clients
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', { products: staffProducts });
      console.log('📡 Emitted products_updated event to all connected clients');
    }
    
    console.log(`✅ Products updated by ${req.user.email} (${req.user.role})`);
    
    res.json({
      success: true,
      data: staffProducts,
      message: 'Products saved successfully'
    });
  } catch (error) {
    console.error('Error saving products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single product by ID
router.get('/products/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const productId = parseInt(req.params.id);
    const product = staffProducts.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update single product
router.put('/products/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const productId = parseInt(req.params.id);
    const { name, price, isArchived } = req.body;
    
    const productIndex = staffProducts.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    staffProducts[productIndex] = {
      ...staffProducts[productIndex],
      name: name || staffProducts[productIndex].name,
      price: price !== undefined ? parseFloat(price) : staffProducts[productIndex].price,
      isArchived: isArchived !== undefined ? isArchived : staffProducts[productIndex].isArchived
    };
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', { products: staffProducts });
    }
    
    console.log(`✅ Product ${productId} updated by ${req.user.email}`);
    
    res.json({
      success: true,
      data: staffProducts[productIndex],
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new product
router.post('/products/add', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const { name, price } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product name and price are required' 
      });
    }
    
    const newId = Math.max(...staffProducts.map(p => p.id), 0) + 1;
    const newProduct = {
      id: newId,
      name,
      price: parseFloat(price),
      isArchived: false
    };
    
    staffProducts.push(newProduct);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', { products: staffProducts });
    }
    
    console.log(`✅ New product added by ${req.user.email}: ${name} - ₱${price}`);
    
    res.json({
      success: true,
      data: newProduct,
      message: 'Product added successfully'
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Archive product (soft delete)
router.delete('/products/:id/archive', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const productId = parseInt(req.params.id);
    const productIndex = staffProducts.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    staffProducts[productIndex].isArchived = true;
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', { products: staffProducts });
    }
    
    console.log(`✅ Product ${productId} archived by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Product archived successfully'
    });
  } catch (error) {
    console.error('Error archiving product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restore product from archive
router.put('/products/:id/restore', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const productId = parseInt(req.params.id);
    const productIndex = staffProducts.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    staffProducts[productIndex].isArchived = false;
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', { products: staffProducts });
    }
    
    console.log(`✅ Product ${productId} restored by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Product restored successfully'
    });
  } catch (error) {
    console.error('Error restoring product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete product permanently
router.delete('/products/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Staff or Admin only.' 
      });
    }
    
    const productId = parseInt(req.params.id);
    const productIndex = staffProducts.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    // Prevent deleting last active product
    const activeCount = staffProducts.filter(p => !p.isArchived).length;
    if (!staffProducts[productIndex].isArchived && activeCount <= 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete the last active product' 
      });
    }
    
    staffProducts.splice(productIndex, 1);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', { products: staffProducts });
    }
    
    console.log(`✅ Product ${productId} permanently deleted by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Product deleted permanently'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;