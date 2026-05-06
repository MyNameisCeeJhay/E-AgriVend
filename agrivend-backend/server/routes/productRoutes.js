import express from 'express';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get all products
router.get('/', protect, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk save products
router.post('/bulk', protect, async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ success: false, error: 'Invalid products data' });
    }
    
    // Clear existing products and insert new ones
    await Product.deleteMany({});
    const savedProducts = await Product.insertMany(products);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', savedProducts);
    }
    
    console.log(`✅ Products updated by ${req.user.email}`);
    
    res.json({ success: true, data: savedProducts });
  } catch (error) {
    console.error('Error saving products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add single product
router.post('/', protect, async (req, res) => {
  try {
    const { name, price } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }
    
    const product = new Product({
      id: Date.now(),
      name,
      price: parseFloat(price),
      isArchived: false
    });
    
    await product.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', [product]);
    }
    
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, price, isArchived } = req.body;
    const product = await Product.findOne({ id: parseInt(req.params.id) });
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (name) product.name = name;
    if (price) product.price = parseFloat(price);
    if (isArchived !== undefined) product.isArchived = isArchived;
    
    await product.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', [product]);
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete product
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ id: parseInt(req.params.id) });
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('products_updated', []);
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;