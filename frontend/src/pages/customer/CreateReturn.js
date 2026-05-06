const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CustomerDashboard.css';



const CreateReturn = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transactionId: '',
    riceType: 'Sinandomeng',
    quantityKg: '',
    amountPaid: '',
    returnReason: ''
  });
  const [receipt, setReceipt] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setReceipt(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append('receipt', receipt);
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });

    try {
      await axios.post(`${API_URL}/returns`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/customer/returns');
    } catch (error) {
      console.error('Error creating return:', error);
      alert('Failed to create return request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div className="content-container">
        <div className="page-header">
          <h1>Request a Return</h1>
          <p>Please provide details about your return</p>
        </div>

        <div className="form-container">
          <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Transaction ID *</label>
                  <input
                    type="text"
                    name="transactionId"
                    value={formData.transactionId}
                    onChange={handleChange}
                    required
                    className="form-input"
                    placeholder="e.g., TXN-123456"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rice Type *</label>
                  <select
                    name="riceType"
                    value={formData.riceType}
                    onChange={handleChange}
                    required
                    className="form-select"
                  >
                    <option value="Sinandomeng">Sinandomeng</option>
                    <option value="Dinorado">Dinorado</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity (kg) *</label>
                    <input
                      type="number"
                      name="quantityKg"
                      value={formData.quantityKg}
                      onChange={handleChange}
                      required
                      step="0.1"
                      min="0.1"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount Paid (₱) *</label>
                    <input
                      type="number"
                      name="amountPaid"
                      value={formData.amountPaid}
                      onChange={handleChange}
                      required
                      step="0.01"
                      min="0"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Return Reason *</label>
                  <textarea
                    name="returnReason"
                    value={formData.returnReason}
                    onChange={handleChange}
                    required
                    rows="3"
                    className="form-textarea"
                    placeholder="Please explain why you're returning this item..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Receipt Image *</label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    required
                    className="form-input"
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                    Upload a clear photo of your receipt
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/returns')}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateReturn;
