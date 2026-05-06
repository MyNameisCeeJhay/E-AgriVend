const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './StaffManagement.css';


const StaffManagement = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
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
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    role: 'staff',
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
    fetchStaff();

    if (socket) {
      socket.on('staff_created', (data) => {
        showNotification('success', `New staff ${data.name} created`);
        fetchStaff();
      });

      socket.on('staff_updated', (data) => {
        showNotification('info', `Staff ${data.name} updated`);
        fetchStaff();
      });

      socket.on('staff_deleted', (data) => {
        showNotification('warning', `Staff ${data.email} deleted`);
        fetchStaff();
      });

      socket.on('staff_status_changed', (data) => {
        showNotification('info', `Staff ${data.action}`);
        fetchStaff();
      });

      return () => {
        socket.off('staff_created');
        socket.off('staff_updated');
        socket.off('staff_deleted');
        socket.off('staff_status_changed');
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

  const fetchStaff = async () => {
  try {
    setLoading(true);
    const response = await axios.get(`${API_URL}/admin/users`, {
      params: {
        page: pagination.page,
        limit: 10,
        search: filters.search,
        status: filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        role: 'staff'
      }
    });
    // PROBLEM IS HERE - Check the actual response structure
    console.log('Full response:', response.data); // Add this for debugging
    console.log('API Response:', response.data);
    console.log('Staff data:', response.data.data);
    console.log('Staff count:', response.data.data?.length);
    
    // Try this instead:
    setStaffMembers(response.data.data || []);  // Your current code
    setPagination(response.data.pagination);
    setStats(response.data.stats);
  } catch (error) {
    console.error('Error fetching staff:', error);
    showNotification('error', 'Failed to load staff members');
  } finally {
    setLoading(false);
  }
};

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchStaff();
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 });
  };

  const handleSelectStaff = (staffId) => {
    setSelectedStaff(prev => {
      if (prev.includes(staffId)) {
        return prev.filter(id => id !== staffId);
      } else {
        return [...prev, staffId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedStaff.length === staffMembers.length) {
      setSelectedStaff([]);
    } else {
      setSelectedStaff(staffMembers.map(s => s._id));
    }
  };

  const handleAddStaff = () => {
    setEditingStaff(null);
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      role: 'staff',
      isActive: true
    });
    setShowStaffModal(true);
  };

  const handleEditStaff = (staff) => {
    setEditingStaff(staff);
    setFormData({
      email: staff.email,
      password: '',
      firstName: staff.firstName,
      lastName: staff.lastName,
      phone: staff.phone || '',
      address: staff.address || '',
      role: staff.role,
      isActive: staff.isActive
    });
    setShowStaffModal(true);
  };

  const handleSubmitStaff = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingStaff) {
        await axios.put(`${API_URL}/admin/users/${editingStaff._id}`, formData);
        showNotification('success', 'Staff member updated successfully');
      } else {
        await axios.post(`${API_URL}/admin/users`, formData);
        showNotification('success', 'Staff member created successfully');
      }
      setShowStaffModal(false);
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
      showNotification('error', error.response?.data?.error || 'Failed to save staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staffId) => {
    try {
      const response = await axios.patch(`${API_URL}/admin/users/${staffId}/toggle-status`);
      showNotification('success', response.data.message);
      fetchStaff();
    } catch (error) {
      console.error('Error toggling status:', error);
      showNotification('error', error.response?.data?.error || 'Failed to toggle status');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    try {
      await axios.delete(`${API_URL}/admin/users/${staffId}`);
      showNotification('success', 'Staff member deleted successfully');
      setShowDeleteConfirm(null);
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      showNotification('error', error.response?.data?.error || 'Failed to delete staff');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await axios.post(`${API_URL}/admin/users/bulk/delete`, { userIds: selectedStaff });
      showNotification('success', `${selectedStaff.length} staff members deleted successfully`);
      setSelectedStaff([]);
      setShowBulkDeleteConfirm(false);
      fetchStaff();
    } catch (error) {
      console.error('Error bulk deleting staff:', error);
      showNotification('error', error.response?.data?.error || 'Failed to delete staff');
    }
  };

  const handleBulkStatusUpdate = async (isActive) => {
    try {
      await axios.post(`${API_URL}/admin/users/bulk/status`, {
        userIds: selectedStaff,
        isActive
      });
      showNotification('success', `${selectedStaff.length} staff members updated successfully`);
      setSelectedStaff([]);
      fetchStaff();
    } catch (error) {
      console.error('Error updating staff:', error);
      showNotification('error', error.response?.data?.error || 'Failed to update staff');
    }
  };

  const handleResetPassword = async (staffId) => {
    try {
      await axios.post(`${API_URL}/admin/users/${staffId}/reset-password`, {
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
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="staff-management-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="staff-management-header">
        <div className="staff-management-header-left">
          <h1>Staff Management</h1>
          <p>Manage staff accounts and permissions</p>
        </div>
        <div className="staff-management-header-right">
          <button className="btn-primary" onClick={handleAddStaff}>
            Add Staff
          </button>
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="staff-management-stats">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Staff</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Active</div>
            <div className="stat-value success">{stats.active}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Inactive</div>
            <div className="stat-value danger">{stats.inactive}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">New This Week</div>
            <div className="stat-value">{stats.newToday}</div>
          </div>
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
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="filter-select"
              >
                <option value="createdAt">Join Date</option>
                <option value="firstName">Name</option>
                <option value="email">Email</option>
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
      {selectedStaff.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="selected-count">
            {selectedStaff.length} staff member{selectedStaff.length > 1 ? 's' : ''} selected
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
            <button className="bulk-btn bulk-btn-secondary" onClick={() => setSelectedStaff([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Staff Table */}
      {loading ? (
        <div className="loading-state">Loading staff members...</div>
      ) : staffMembers.length === 0 ? (
        <div className="empty-state">
          <h3>No Staff Members Found</h3>
          <p>No staff accounts match your search criteria.</p>
          <button className="btn-primary" onClick={handleAddStaff}>
            Add Your First Staff Member
          </button>
        </div>
      ) : (
        <div className="staff-management-table">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedStaff.length === staffMembers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Staff Member</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((staffMember) => (
                  <tr key={staffMember._id} className={!staffMember.isActive ? 'inactive-row' : ''}>
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedStaff.includes(staffMember._id)}
                        onChange={() => handleSelectStaff(staffMember._id)}
                      />
                    </td>
                    <td>
                      <div className="user-cell">
                        <div className="user-info">
                          <div className="user-name">
                            {staffMember.firstName} {staffMember.lastName}
                          </div>
                          <div className="user-email">{staffMember.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="contact-info">
                      {staffMember.phone && <div className="contact-phone">{staffMember.phone}</div>}
                      {!staffMember.phone && <span className="no-contact">No phone</span>}
                    </td>
                    <td>
                      <span className="role-badge staff">Staff</span>
                    </td>
                    <td>
                      <span className={`status-badge ${staffMember.isActive ? 'active' : 'inactive'}`}>
                        {staffMember.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(staffMember.createdAt)}</td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleEditStaff(staffMember)}
                        >
                          Edit
                        </button>
                        <button
                          className="action-btn action-btn-status"
                          onClick={() => handleToggleStatus(staffMember._id)}
                        >
                          {staffMember.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="action-btn action-btn-password"
                          onClick={() => setShowPasswordModal(staffMember)}
                        >
                          Reset Password
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => setShowDeleteConfirm(staffMember)}
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
        <div className="staff-management-pagination">
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

      {/* Add/Edit Staff Modal */}
      {showStaffModal && (
        <div className="modal-overlay" onClick={() => setShowStaffModal(false)}>
          <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
              <button className="modal-close" onClick={() => setShowStaffModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSubmitStaff}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
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
                      name="lastName"
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
                    name="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                {!editingStaff && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="form-input"
                      required={!editingStaff}
                      minLength="6"
                    />
                    <small className="form-help-text">Password must be at least 6 characters</small>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="form-select"
                    >
                      <option value="staff">Staff</option>
                    </select>
                    <small className="form-help-text">Staff have limited view-only access</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      name="isActive"
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
                  <button type="button" onClick={() => setShowStaffModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : editingStaff ? 'Update Staff' : 'Create Staff'}
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
              <h2>Delete Staff Member</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{showDeleteConfirm.firstName} {showDeleteConfirm.lastName}</strong>?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={() => handleDeleteStaff(showDeleteConfirm._id)} className="btn-danger">
                Delete Staff
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
              <h2>Delete Staff Members</h2>
              <button className="modal-close" onClick={() => setShowBulkDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{selectedStaff.length}</strong> selected staff members?</p>
              <p className="warning-text">This action cannot be undone.</p>
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
              <p>Reset password for <strong>{showPasswordModal.firstName} {showPasswordModal.lastName}</strong></p>
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

export default StaffManagement;