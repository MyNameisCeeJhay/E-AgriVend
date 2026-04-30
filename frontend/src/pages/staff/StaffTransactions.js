const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './StaffTransactions.css';

const StaffTransactions = () => {
  const { socket } = useSocket();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalTransactions: 0, totalQuantity: 0, totalRevenue: 0 });
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1, limit: 15 });
  const [filters, setFilters] = useState({ startDate: '', endDate: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', price: '' });
  
  const [newTransaction, setNewTransaction] = useState({
    productName: '',
    quantity: '',
    pricePerKg: '',
    totalAmount: '',
    paymentMethod: 'CASH'
  });

  useEffect(() => {
    fetchProducts();
    fetchTransactions();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/staff/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setProducts(response.data.data);
      } else {
        setProducts([
          { id: 1, name: 'Sinandomeng Rice', price: 54.00, isArchived: false },
          { id: 2, name: 'Dinorado Rice', price: 65.00, isArchived: false },
          { id: 3, name: 'Jasmine Rice', price: 70.00, isArchived: false },
          { id: 4, name: 'Premium Rice', price: 85.00, isArchived: false },
          { id: 5, name: 'Brown Rice', price: 60.00, isArchived: false },
          { id: 6, name: 'Glutinous Rice', price: 75.00, isArchived: false },
          { id: 7, name: 'Organic Rice', price: 90.00, isArchived: false }
        ]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([
        { id: 1, name: 'Sinandomeng Rice', price: 54.00, isArchived: false },
        { id: 2, name: 'Dinorado Rice', price: 65.00, isArchived: false },
        { id: 3, name: 'Jasmine Rice', price: 70.00, isArchived: false },
        { id: 4, name: 'Premium Rice', price: 85.00, isArchived: false },
        { id: 5, name: 'Brown Rice', price: 60.00, isArchived: false },
        { id: 6, name: 'Glutinous Rice', price: 75.00, isArchived: false },
        { id: 7, name: 'Organic Rice', price: 90.00, isArchived: false }
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const saveProductsToDatabase = async (updatedProducts) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/staff/products`, {
        products: updatedProducts
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error saving products:', error);
      showNotification('error', 'Failed to save products to database');
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on('new_transaction', () => {
        fetchTransactions();
        showNotification('success', 'New transaction added');
      });
      
      socket.on('products_updated', () => {
        fetchProducts();
      });
      
      return () => {
        socket.off('new_transaction');
        socket.off('products_updated');
      };
    }
  }, [socket, pagination.page, filters]);

  const activeProducts = products.filter(p => !p.isArchived);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/transactions`, {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          startDate: filters.startDate,
          endDate: filters.endDate,
          search: filters.search
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const data = response.data.data || [];
        setTransactions(data);
        setPagination(response.data.pagination || { page: 1, total: 0, pages: 1, limit: 15 });
        setSummary(response.data.summary || { totalTransactions: 0, totalQuantity: 0, totalRevenue: 0 });
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showNotification('error', 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const generateTransactionId = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random1 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN-${year}${month}${day}-${random1}-${random2}`;
    };

  const handleArchiveProduct = async (id) => {
    const updatedProducts = products.map(p => 
      p.id === id ? { ...p, isArchived: true } : p
    );
    setProducts(updatedProducts);
    await saveProductsToDatabase(updatedProducts);
    showNotification('success', 'Product archived successfully');
  };

  const handleRestoreProduct = async (id) => {
    const updatedProducts = products.map(p => 
      p.id === id ? { ...p, isArchived: false } : p
    );
    setProducts(updatedProducts);
    await saveProductsToDatabase(updatedProducts);
    showNotification('success', 'Product restored successfully');
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      showNotification('error', 'Please enter product name and price');
      return;
    }
    
    const newId = Math.max(...products.map(p => p.id), 0) + 1;
    const updatedProducts = [...products, {
      id: newId,
      name: newProduct.name,
      price: parseFloat(newProduct.price),
      isArchived: false
    }];
    
    setProducts(updatedProducts);
    await saveProductsToDatabase(updatedProducts);
    
    setNewProduct({ name: '', price: '' });
    setShowProductModal(false);
    showNotification('success', `Product "${newProduct.name}" added successfully`);
  };

  const handleEditProduct = async () => {
    if (!editingProduct.name || !editingProduct.price) {
      showNotification('error', 'Please enter product name and price');
      return;
    }
    
    const updatedProducts = products.map(p => 
      p.id === editingProduct.id 
        ? { ...p, name: editingProduct.name, price: parseFloat(editingProduct.price) }
        : p
    );
    
    setProducts(updatedProducts);
    await saveProductsToDatabase(updatedProducts);
    
    setEditingProduct(null);
    setShowProductModal(false);
    showNotification('success', `Product updated successfully`);
  };

  const handleDeleteProduct = async (id) => {
    if (activeProducts.length <= 1 && !products.find(p => p.id === id).isArchived) {
      showNotification('error', 'Cannot delete the last active product');
      return;
    }
    
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
    await saveProductsToDatabase(updatedProducts);
    showNotification('success', 'Product deleted permanently');
  };

  const openEditModal = (product) => {
    setEditingProduct({ ...product });
    setShowProductModal(true);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      
      const transactionData = {
        productName: newTransaction.productName,
        quantityKg: parseFloat(newTransaction.quantity),
        amountPaid: parseFloat(newTransaction.totalAmount),
        paymentMethod: newTransaction.paymentMethod || 'CASH'
      };
      
      console.log('Sending transaction:', transactionData);
      
      const response = await axios.post(`${API_URL}/transactions`, transactionData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        showNotification('success', `Transaction added: ${newTransaction.quantity}kg ${newTransaction.productName} - ₱${newTransaction.totalAmount}`);
        setShowAddModal(false);
        setNewTransaction({
          productName: '',
          quantity: '',
          pricePerKg: '',
          totalAmount: '',
          paymentMethod: 'CASH'
        });
        fetchTransactions();
      } else {
        showNotification('error', response.data.error || 'Failed to add transaction');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to add transaction';
      showNotification('error', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = (quantity, price) => {
    if (quantity && price && parseFloat(quantity) > 0 && parseFloat(price) > 0) {
      return (parseFloat(quantity) * parseFloat(price)).toFixed(2);
    }
    return '';
  };

  const handleProductChange = (e) => {
    const productName = e.target.value;
    const selectedProduct = activeProducts.find(p => p.name === productName);
    setNewTransaction(prev => {
      const updated = { 
        ...prev, 
        productName,
        pricePerKg: selectedProduct ? selectedProduct.price.toString() : ''
      };
      updated.totalAmount = calculateTotal(updated.quantity, updated.pricePerKg);
      return updated;
    });
  };

  const handleQuantityChange = (e) => {
    const quantity = e.target.value;
    setNewTransaction(prev => {
      const updated = { ...prev, quantity };
      updated.totalAmount = calculateTotal(updated.quantity, updated.pricePerKg);
      return updated;
    });
  };

  const handlePriceChange = (e) => {
    const price = e.target.value;
    setNewTransaction(prev => {
      const updated = { ...prev, pricePerKg: price };
      updated.totalAmount = calculateTotal(updated.quantity, updated.pricePerKg);
      return updated;
    });
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDisplayProductName = (transaction) => {
    return transaction.productName || transaction.riceType || 'Unknown';
  };

  return (
    <div className="staff-transactions-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`transaction-toast ${notification.type}`}>
          <div className="toast-content">
            <span className="toast-icon">{notification.type === 'success' ? '✓' : '⚠'}</span>
            <span>{notification.message}</span>
          </div>
          <button className="toast-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="transactions-header">
        <div>
          <h1>Transaction History</h1>
          <p>View and manage all walk-in customer transactions</p>
        </div>
        <div className="header-buttons">
          <button className="btn-add" onClick={() => setShowAddModal(true)}>
            + Walk-in Customer
          </button>
          <button className="btn-manage-products" onClick={() => {
            setEditingProduct(null);
            setNewProduct({ name: '', price: '' });
            setShowProductModal(true);
          }}>
            Manage Products
          </button>
          <button className={`btn-filter ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-label">Total Transactions</div>
          <div className="card-value">{summary.totalTransactions}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Total Quantity</div>
          <div className="card-value">{summary.totalQuantity.toFixed(1)} kg</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Total Revenue</div>
          <div className="card-value">{formatCurrency(summary.totalRevenue)}</div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <input 
              type="date" 
              value={filters.startDate} 
              onChange={(e) => setFilters({...filters, startDate: e.target.value})} 
              placeholder="Start Date" 
            />
            <input 
              type="date" 
              value={filters.endDate} 
              onChange={(e) => setFilters({...filters, endDate: e.target.value})} 
              placeholder="End Date" 
            />
            <input 
              type="text" 
              placeholder="Search by Transaction ID or Product..." 
              value={filters.search} 
              onChange={(e) => setFilters({...filters, search: e.target.value})} 
            />
            <button className="btn-apply" onClick={fetchTransactions}>Apply</button>
            <button className="btn-clear" onClick={() => { 
              setFilters({ startDate: '', endDate: '', search: '' }); 
              fetchTransactions(); 
            }}>Clear</button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="transactions-table-container">
        {loading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Transactions Found</h3>
            <p>No transactions match your search criteria.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="business-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Price/kg</th>
                    <th>Total Amount</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t._id}>
                      <td className="tx-id">{t.transactionId}</td>
                      <td className="date-cell">{formatDate(t.createdAt)}</td>
                      <td className="product-cell">{getDisplayProductName(t)}</td>
                      <td className="quantity-cell">{t.quantityKg} kg</td>
                      <td className="price-cell">{formatCurrency(t.pricePerKg || t.amountPaid / t.quantityKg)}</td>
                      <td className="amount-cell">{formatCurrency(t.amountPaid)}</td>
                      <td className="payment-cell">{t.paymentMethod || 'CASH'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination-container">
                <button 
                  disabled={pagination.page === 1} 
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </button>
                <span>Page {pagination.page} of {pagination.pages}</span>
                <button 
                  disabled={pagination.page === pagination.pages} 
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Walk-in Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Walk-in Customer Transaction</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleAddTransaction}>
                <div className="form-group">
                  <label>Select Product *</label>
                  <select
                    value={newTransaction.productName}
                    onChange={handleProductChange}
                    required
                  >
                    <option value="">Select Product</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      value={newTransaction.quantity}
                      onChange={handleQuantityChange}
                      placeholder="Enter quantity"
                      required
                    />
                    <small className="help-text">Maximum 5kg per transaction</small>
                  </div>

                  <div className="form-group">
                    <label>Price per kg (₱) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={newTransaction.pricePerKg}
                      onChange={handlePriceChange}
                      placeholder="Enter price"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Total Amount (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTransaction.totalAmount}
                    disabled
                    className="readonly-field"
                    placeholder="Auto-calculated"
                  />
                  <small className="help-text">
                    {newTransaction.quantity && newTransaction.pricePerKg ? 
                      `Calculation: ${newTransaction.quantity}kg × ₱${newTransaction.pricePerKg} = ${formatCurrency(parseFloat(newTransaction.totalAmount) || 0)}` : 
                      'Enter quantity and price to calculate total'}
                  </small>
                </div>

                <div className="info-box">
                  <p><strong>Transaction Information:</strong></p>
                  <p>Transaction ID: <strong>{generateTransactionId()}</strong> (Auto-generated)</p>
                  <p><strong>Payment Method:</strong> CASH ONLY</p>
                  <p><strong>Status:</strong> COMPLETED</p>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-submit" 
                    disabled={isSubmitting || !newTransaction.productName || !newTransaction.quantity || !newTransaction.pricePerKg || parseFloat(newTransaction.quantity) <= 0}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Transaction'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage Products Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Manage Products'}</h2>
              <button className="modal-close" onClick={() => setShowProductModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {loadingProducts ? (
                <div className="loading-state">Loading products...</div>
              ) : (
                <>
                  {/* Add New Product Section */}
                  {!editingProduct && (
                    <div className="add-product-section">
                      <h3>Add New Product</h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Product Name</label>
                          <input
                            type="text"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                            placeholder="Enter product name"
                          />
                        </div>
                        <div className="form-group">
                          <label>Price per kg (₱)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                            placeholder="Enter price per kg"
                          />
                        </div>
                        <div className="form-group add-btn-group">
                          <button className="btn-add-product" onClick={handleAddProduct}>
                            + Add Product
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edit Product Section */}
                  {editingProduct && (
                    <div className="edit-product-section">
                      <h3>Edit Product</h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Product Name</label>
                          <input
                            type="text"
                            value={editingProduct.name}
                            onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Price per kg (₱)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingProduct.price}
                            onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Toggle Archived View */}
                  <div className="archive-toggle">
                    <button 
                      className={`toggle-btn ${!showArchived ? 'active' : ''}`}
                      onClick={() => setShowArchived(false)}
                    >
                      Active Products
                    </button>
                    <button 
                      className={`toggle-btn ${showArchived ? 'active' : ''}`}
                      onClick={() => setShowArchived(true)}
                    >
                      Archived Products
                    </button>
                  </div>

                  {/* Products List */}
                  <div className="products-list">
                    <h3>{showArchived ? 'Archived Products' : 'Active Products'}</h3>
                    <div className="products-table-wrapper">
                      <table className="products-table">
                        <thead>
                          <tr>
                            <th>Product Name</th>
                            <th>Price per kg</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.filter(p => showArchived ? p.isArchived : !p.isArchived).map((product) => (
                            <tr key={product.id}>
                              <td>{product.name}</td>
                              <td>{formatCurrency(product.price)}</td>
                              <td className="product-actions">
                                {!showArchived ? (
                                  <>
                                    <button 
                                      className="btn-edit-product"
                                      onClick={() => openEditModal(product)}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      className="btn-archive-product"
                                      onClick={() => handleArchiveProduct(product.id)}
                                    >
                                      Archive
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      className="btn-restore-product"
                                      onClick={() => handleRestoreProduct(product.id)}
                                    >
                                      Restore
                                    </button>
                                    <button 
                                      className="btn-delete-product"
                                      onClick={() => handleDeleteProduct(product.id)}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="info-note">
                    <p>Note: Products added here will be available in the transaction dropdown.</p>
                    <p>Archive products to remove them from the dropdown without deleting them.</p>
                    <p>Deleted products are permanently removed from the system.</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-footer">
              {editingProduct && (
                <>
                  <button className="btn-cancel" onClick={() => setEditingProduct(null)}>
                    Cancel Edit
                  </button>
                  <button className="btn-save" onClick={handleEditProduct}>
                    Save Changes
                  </button>
                </>
              )}
              {!editingProduct && (
                <button className="btn-cancel" onClick={() => setShowProductModal(false)}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTransactions;