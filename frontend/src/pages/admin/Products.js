import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './Products.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pricePerKg: '',
    category: 'Rice',
    stock: '',
    unit: 'kg'
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [showArchived, searchTerm, selectedCategory]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/products`, {
        params: {
          showArchived: showArchived.toString(),
          search: searchTerm,
          category: selectedCategory
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setProducts(response.data.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      showNotification('error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/products/categories/list`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCategories(response.data.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        pricePerKg: product.pricePerKg,
        category: product.category,
        stock: product.stock,
        unit: product.unit
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        pricePerKg: '',
        category: 'Rice',
        stock: '',
        unit: 'kg'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      pricePerKg: '',
      category: 'Rice',
      stock: '',
      unit: 'kg'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.pricePerKg) {
      showNotification('error', 'Product name and price are required');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (editingProduct) {
        await axios.put(`${API_URL}/products/${editingProduct._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showNotification('success', 'Product updated successfully');
      } else {
        await axios.post(`${API_URL}/products`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showNotification('success', 'Product created successfully');
      }
      handleCloseModal();
      fetchProducts();
    } catch (error) {
      showNotification('error', error.response?.data?.error || 'Operation failed');
    }
  };

  const handleArchive = async (product) => {
    if (window.confirm(`Are you sure you want to archive "${product.name}"?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.patch(`${API_URL}/products/${product._id}/archive`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showNotification('success', 'Product archived successfully');
        fetchProducts();
      } catch (error) {
        showNotification('error', 'Failed to archive product');
      }
    }
  };

  const handleRestore = async (product) => {
    if (window.confirm(`Are you sure you want to restore "${product.name}"?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.patch(`${API_URL}/products/${product._id}/restore`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showNotification('success', 'Product restored successfully');
        fetchProducts();
      } catch (error) {
        showNotification('error', 'Failed to restore product');
      }
    }
  };

  const handleDelete = async (product) => {
    if (window.confirm(`Permanently delete "${product.name}"? This action cannot be undone.`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/products/${product._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showNotification('success', 'Product deleted permanently');
        fetchProducts();
      } catch (error) {
        showNotification('error', 'Failed to delete product');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="products-container">
      {/* Notification */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="products-header">
        <div>
          <h1>Product Management</h1>
          <p>Manage your rice products, prices, and inventory</p>
        </div>
        <button className="btn-add" onClick={() => handleOpenModal()}>
          + Add New Product
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={fetchProducts}>🔍</button>
        </div>
        
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="category-filter"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        
        <label className="archived-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived
        </label>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="loading-state">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <h3>No Products Found</h3>
          <p>Click "Add New Product" to create your first product.</p>
        </div>
      ) : (
        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Price per kg</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id} className={product.isArchived ? 'archived-row' : ''}>
                  <td>
                    <div className="product-name">
                      <strong>{product.name}</strong>
                      {product.description && (
                        <small>{product.description}</small>
                      )}
                    </div>
                  </td>
                   <td>{product.category}</td>
                  <td className="price-cell">{formatCurrency(product.pricePerKg)}</td>
                  <td className="stock-cell">
                    <span className={product.stock < 10 ? 'low-stock' : ''}>
                      {product.stock} {product.unit}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${product.isActive ? 'active' : 'inactive'}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {product.isArchived && (
                      <span className="status-badge archived">Archived</span>
                    )}
                  </td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => handleOpenModal(product)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {!product.isArchived ? (
                        <button 
                          className="btn-archive"
                          onClick={() => handleArchive(product)}
                          title="Archive"
                        >
                          📦
                        </button>
                      ) : (
                        <button 
                          className="btn-restore"
                          onClick={() => handleRestore(product)}
                          title="Restore"
                        >
                          ↩️
                        </button>
                      )}
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(product)}
                        title="Delete Permanently"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal - No Image Field */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Sinandomeng Rice"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    <option value="Rice">Rice</option>
                    <option value="Premium Rice">Premium Rice</option>
                    <option value="Organic Rice">Organic Rice</option>
                    <option value="Specialty Rice">Specialty Rice</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Price per Kilogram (₱) *</label>
                  <input
                    type="number"
                    name="pricePerKg"
                    value={formData.pricePerKg}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleInputChange}>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="sack">Sack</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Product description..."
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;