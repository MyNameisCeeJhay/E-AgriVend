import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5000/api';

const Terms = () => {
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const { user, acceptTerms } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const response = await axios.get(`${API_URL}/terms/current`);
      setTerms(response.data);
    } catch (error) {
      console.error('Error fetching terms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!accepted) return;
    const result = await acceptTerms(terms.id);
    if (result.success) {
      navigate(user?.role === 'admin' ? '/admin/dashboard' : '/customer/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div style={{ border: '3px solid #f3f4f6', borderTop: '3px solid #10b981', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-green-600">
          <h1 className="text-xl font-semibold text-white">Terms and Conditions</h1>
          <p className="text-sm text-green-100">
            Version {terms?.version || '1.0'}
          </p>
        </div>
        
        <div className="px-6 py-4">
          <div className="prose" style={{ maxHeight: '400px', overflowY: 'auto', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
              {terms?.content || 'By using AgriVend services, you agree to the following terms and conditions...'}
            </p>
          </div>
          
          <div className="mt-6 border-t pt-6">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <input
                type="checkbox"
                id="accept"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ width: 'auto', marginRight: '8px' }}
              />
              <label htmlFor="accept" style={{ fontSize: '14px' }}>
                I have read and agree to the Terms and Conditions
              </label>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => navigate(-1)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={!accepted}
                className="btn-primary"
                style={{ opacity: !accepted ? 0.5 : 1, cursor: !accepted ? 'not-allowed' : 'pointer' }}
              >
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;