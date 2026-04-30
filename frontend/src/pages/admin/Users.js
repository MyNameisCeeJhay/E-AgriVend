import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Users.css';

const API_URL = 'https://e-agrivend.onrender.com/api';

const AdminUsers = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    newToday: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    role: 'admin',
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchUsers();

    if (socket) {
      socket.on('user_created', (data) => {
        showNotification('success', `New user ${data.name} created`);
        fetchUsers();
      });

      socket.on('user_updated', (data) => {
        showNotification('info', `User ${data.name} updated`);
        fetchUsers();
      });

      socket.on('user_deleted', (data) => {
        showNotification('warning', `User ${data.email} deleted`);
        fetchUsers();
      });

      socket.on('user_status_changed', (data) => {
        showNotification('info', `User ${data.action}`);
        fetchUsers();
      });

      return () => {
        socket.off('user_created');
        socket.off('user_updated');
        socket.off('user_deleted');
        socket.off('user_status_changed');
      };
    }
  }, [socket, pagination.page, filters]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/admin/users`, {
        params: {
          page: pagination.page,
          limit: 10,
          ...filters,
          role: 'admin'
        }
      });
      setUsers(response.data.data);
      setPagination(response.data.pagination);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching users:', error);
      showNotification('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchUsers();
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 });
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u._id));
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      role: 'admin',
      isActive: true
    });
    setShowUserModal(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      address: user.address || '',
      role: user.role,
      isActive: user.isActive
    });
    setShowUserModal(true);
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingUser) {
        await axios.put(`${API_URL}/admin/users/${editingUser._id}`, formData);
        showNotification('success', 'User updated successfully');
      } else {
        await axios.post(`${API_URL}/admin/users`, formData);
        showNotification('success', 'User created successfully');
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      showNotification('error', error.response?.data?.error || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const response = await axios.patch(`${API_URL}/admin/users/${userId}/toggle-status`);
      showNotification('success', response.data.message);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
      showNotification('error', error.response?.data?.error || 'Failed to toggle status');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${API_URL}/admin/users/${userId}`);
      showNotification('success', 'User deleted successfully');
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('error', error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await axios.post(`${API_URL}/admin/users/bulk/delete`, { userIds: selectedUsers });
      showNotification('success', `${selectedUsers.length} users deleted successfully`);
      setSelectedUsers([]);
      setShowBulkDeleteConfirm(false);
      fetchUsers();
    } catch (error) {
      console.error('Error bulk deleting users:', error);
      showNotification('error', error.response?.data?.error || 'Failed to delete users');
    }
  };

  const handleBulkStatusUpdate = async (isActive) => {
    try {
      await axios.post(`${API_URL}/admin/users/bulk/status`, { 
        userIds: selectedUsers,
        isActive 
      });
      showNotification('success', `${selectedUsers.length} users updated successfully`);
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error('Error updating users:', error);
      showNotification('error', error.response?.data?.error || 'Failed to update users');
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      await axios.post(`${API_URL}/admin/users/${userId}/reset-password`, { 
        newPassword 
      });
      showNotification('success', 'Password reset successfully');
      setShowPasswordModal(null);
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      showNotification('error', error.response?.data?.error || 'Failed to reset password');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="usermanagement-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="usermanagement-header">
        <div className="usermanagement-header-left">
          <h1>Admin Management</h1>
          <p>Manage administrator accounts and permissions</p>
        </div>
        <div className="usermanagement-header-right">
          <button className="btn-primary" onClick={handleAddUser}>
            Add Admin
          </button>
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="usermanagement-stats">
        <div className="stat-card">
          <div className="stat-label">Total Admins</div>
          <div className="stat-value">{stats.admins}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value success">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactive</div>
          <div className="stat-value danger">{stats.inactive}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New Today</div>
          <div className="stat-value success">{stats.newToday}</div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filters-card">
          <form onSubmit={handleSearch} className="filters-form">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="search-input"
              />
              <button type="submit" className="search-btn">Search</button>
            </div>
            
            <div className="filter-controls">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="filter-select"
              >
                <option value="createdAt">Join Date</option>
                <option value="firstName">Name</option>
                <option value="email">Email</option>
                <option value="lastLogin">Last Login</option>
              </select>

              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="filter-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="selected-count">
            {selectedUsers.length} admin{selectedUsers.length > 1 ? 's' : ''} selected
          </span>
          <div className="bulk-buttons">
            <button className="bulk-btn bulk-btn-primary" onClick={() => handleBulkStatusUpdate(true)}>
              Activate All
            </button>
            <button className="bulk-btn bulk-btn-warning" onClick={() => handleBulkStatusUpdate(false)}>
              Deactivate All
            </button>
            <button className="bulk-btn bulk-btn-danger" onClick={() => setShowBulkDeleteConfirm(true)}>
              Delete All
            </button>
            <button className="bulk-btn bulk-btn-secondary" onClick={() => setSelectedUsers([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="loading-state">Loading administrators...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <h3>No Administrators Found</h3>
          <p>No administrator accounts match your search criteria.</p>
        </div>
      ) : (
        <div className="usermanagement-table">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((userItem) => (
                  <tr key={userItem._id} className={!userItem.isActive ? 'inactive-row' : ''}>
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(userItem._id)}
                        onChange={() => handleSelectUser(userItem._id)}
                        disabled={userItem._id === user?._id}
                      />
                    </td>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {userItem.firstName?.charAt(0)}{userItem.lastName?.charAt(0)}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
                            {userItem.firstName} {userItem.lastName}
                          </div>
                          <span className="user-role-badge admin">Administrator</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <div className="contact-email">{userItem.email}</div>
                        {userItem.phone && <div className="contact-phone">{userItem.phone}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${userItem.isActive ? 'active' : 'inactive'}`}>
                        {userItem.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(userItem.createdAt)}</td>
                    <td className="date-cell">
                      {userItem.lastLogin ? formatDate(userItem.lastLogin) : 'Never'}
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleEditUser(userItem)}
                          title="Edit administrator"
                        >
                          Edit
                        </button>
                        <button
                          className={`action-btn action-btn-status ${userItem.isActive ? 'active' : ''}`}
                          onClick={() => handleToggleStatus(userItem._id)}
                          title={userItem.isActive ? 'Deactivate administrator' : 'Activate administrator'}
                          disabled={userItem._id === user?._id}
                        >
                          {userItem.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="action-btn action-btn-password"
                          onClick={() => setShowPasswordModal(userItem)}
                          title="Reset administrator password"
                          disabled={userItem._id === user?._id}
                        >
                          Reset Password
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => setShowDeleteConfirm(userItem)}
                          title="Delete administrator"
                          disabled={userItem._id === user?._id}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="usermanagement-pagination">
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            disabled={pagination.page === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            disabled={pagination.page === pagination.pages}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Edit Administrator' : 'Add New Administrator'}</h2>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <form onSubmit={handleSubmitUser}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                {!editingUser && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="form-input"
                      required={!editingUser}
                      minLength="6"
                    />
                    <small className="form-help-text">Password must be at least 6 characters</small>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-textarea"
                    rows="2"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="form-select"
                      disabled
                    >
                      <option value="admin">Administrator</option>
                    </select>
                    <small className="form-help-text">Only administrator accounts can be created</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      value={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                      className="form-select"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => setShowUserModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : editingUser ? 'Update Administrator' : 'Create Administrator'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-container small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <h2>Delete Administrator</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete administrator <strong>{showDeleteConfirm.firstName} {showDeleteConfirm.lastName}</strong>?</p>
              <p className="warning-text">This action cannot be undone. The administrator will lose all access.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={() => handleDeleteUser(showDeleteConfirm._id)} className="btn-danger">
                Delete Administrator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowBulkDeleteConfirm(false)}>
          <div className="modal-container small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <h2>Delete Administrators</h2>
              <button className="modal-close" onClick={() => setShowBulkDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{selectedUsers.length}</strong> selected administrators?</p>
              <p className="warning-text">This action cannot be undone. These administrators will lose all access.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleBulkDelete} className="btn-danger">
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(null)}>
          <div className="modal-container small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Reset password for administrator <strong>{showPasswordModal.firstName} {showPasswordModal.lastName}</strong></p>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter new password"
                  minLength="6"
                />
                <small className="form-help-text">Password must be at least 6 characters</small>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPasswordModal(null)} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={() => handleResetPassword(showPasswordModal._id)} 
                className="btn-primary"
                disabled={!newPassword || newPassword.length < 6}
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;