import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './Reports.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminReports = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('daily');
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [salesSummary, setSalesSummary] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0
  });

  useEffect(() => {
    fetchSalesSummary();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchSalesSummary = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/transactions/stats`);
      setSalesSummary(response.data.data);
    } catch (error) {
      console.error('Error fetching sales summary:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let url = '';
      let params = {};
      
      switch(reportType) {
        case 'daily':
          url = `${API_URL}/admin/reports/daily`;
          params = { date: dateRange.startDate };
          break;
        case 'weekly':
          url = `${API_URL}/admin/reports/weekly`;
          params = { week: getWeekNumber(new Date(dateRange.startDate)) };
          break;
        case 'monthly':
          url = `${API_URL}/admin/reports/monthly`;
          params = { 
            month: new Date(dateRange.startDate).getMonth() + 1,
            year: new Date(dateRange.startDate).getFullYear()
          };
          break;
        case 'custom':
          url = `${API_URL}/admin/reports/custom`;
          params = {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          };
          break;
        default:
          break;
      }
      
      const response = await axios.get(url, { params });
      setReportData(response.data.data);
      showNotification('success', 'Report generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      showNotification('error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const handlePrintReport = () => {
    const printContent = document.getElementById('report-content');
    const originalTitle = document.title;
    document.title = `${reportType.toUpperCase()} Report - ${new Date().toLocaleDateString()}`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${reportType.toUpperCase()} Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .report-header { text-align: center; margin-bottom: 30px; }
            .report-title { font-size: 24px; font-weight: bold; }
            .report-date { color: #666; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { margin-top: 30px; padding: 20px; background-color: #f9f9f9; }
            .total { font-size: 18px; font-weight: bold; color: #10b981; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    document.title = originalTitle;
  };

  const handleDownloadCSV = () => {
    if (!reportData || !reportData.transactions) return;
    
    const headers = ['Transaction ID', 'Date', 'Product', 'Quantity (kg)', 'Unit Price', 'Total Amount'];
    const rows = reportData.transactions.map(t => [
      t.transactionId || t._id.slice(-8),
      new Date(t.createdAt).toLocaleString(),
      t.riceType,
      t.quantityKg,
      t.unitPrice || (t.totalAmount / t.quantityKg),
      t.totalAmount
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('success', 'CSV file downloaded');
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getReportTitle = () => {
    switch(reportType) {
      case 'daily':
        return `Daily Sales Report - ${formatDate(dateRange.startDate)}`;
      case 'weekly':
        return `Weekly Sales Report - Week of ${formatDate(dateRange.startDate)}`;
      case 'monthly':
        const date = new Date(dateRange.startDate);
        return `Monthly Sales Report - ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      case 'custom':
        return `Custom Report - ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`;
      default:
        return 'Sales Report';
    }
  };

  return (
    <div className="admin-page-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-description">
            Generate and export sales reports
          </p>
        </div>
      </div>

      {/* Sales Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Today's Sales</div>
            <div className="stat-value success">{formatCurrency(salesSummary.daily)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">This Week</div>
            <div className="stat-value">{formatCurrency(salesSummary.weekly)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">This Month</div>
            <div className="stat-value">{formatCurrency(salesSummary.monthly)}</div>
          </div>
        </div>
      </div>

      {/* Report Generator */}
      <div className="report-generator">
        <h2>Generate Report</h2>
        <div className="report-controls">
          <div className="report-type-selector">
            <button 
              className={`report-type-btn ${reportType === 'daily' ? 'active' : ''}`}
              onClick={() => setReportType('daily')}
            >
              Daily
            </button>
            <button 
              className={`report-type-btn ${reportType === 'weekly' ? 'active' : ''}`}
              onClick={() => setReportType('weekly')}
            >
              Weekly
            </button>
            <button 
              className={`report-type-btn ${reportType === 'monthly' ? 'active' : ''}`}
              onClick={() => setReportType('monthly')}
            >
              Monthly
            </button>
            <button 
              className={`report-type-btn ${reportType === 'custom' ? 'active' : ''}`}
              onClick={() => setReportType('custom')}
            >
              Custom Range
            </button>
          </div>
          
          <div className="date-range">
            {reportType === 'custom' ? (
              <>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="form-input"
                />
                <span>to</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="form-input"
                />
              </>
            ) : (
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="form-input"
              />
            )}
          </div>
          
          <button 
            className="btn-primary" 
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Report Display */}
      {reportData && (
        <div id="report-content" className="report-content">
          <div className="report-header">
            <h1 className="report-title">{getReportTitle()}</h1>
            <p className="report-date">Generated on: {new Date().toLocaleString()}</p>
            <p className="report-generator">Generated by: {user?.firstName} {user?.lastName}</p>
          </div>
          
          <div className="report-summary">
            <h3>Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Total Transactions:</span>
                <span className="summary-value">{reportData.summary?.totalTransactions || 0}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Quantity Sold:</span>
                <span className="summary-value">{reportData.summary?.totalQuantity || 0} kg</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Sales:</span>
                <span className="summary-value total">{formatCurrency(reportData.summary?.totalSales || 0)}</span>
              </div>
            </div>
          </div>
          
          <div className="report-details">
            <h3>Transaction Details</h3>
            {reportData.transactions && reportData.transactions.length > 0 ? (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>Quantity (kg)</th>
                    <th>Unit Price</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.map((transaction) => (
                    <tr key={transaction._id}>
                      <td>{transaction.transactionId || transaction._id.slice(-8)}</td>
                      <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                      <td>{transaction.riceType}</td>
                      <td>{transaction.quantityKg}</td>
                      <td>{formatCurrency(transaction.unitPrice || transaction.totalAmount / transaction.quantityKg)}</td>
                      <td>{formatCurrency(transaction.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No transactions found for this period.</p>
            )}
          </div>
        </div>
      )}
      
      {/* Report Actions */}
      {reportData && (
        <div className="report-actions no-print">
          <button className="btn-secondary" onClick={handlePrintReport}>
            Print Report
          </button>
          <button className="btn-primary" onClick={handleDownloadCSV}>
            Download CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminReports;