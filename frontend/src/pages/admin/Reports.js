const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './Reports.css';

const AdminReports = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('daily');
  const [transactionSource, setTransactionSource] = useState('all');
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
  const [chartData, setChartData] = useState([]);
  const [activeChartTab, setActiveChartTab] = useState('daily');
  const [productRanking, setProductRanking] = useState([]);
  const [bestSellingProduct, setBestSellingProduct] = useState(null);

  // ============================================
  // HELPER FUNCTIONS FOR TRANSACTION TYPE DETECTION
  // ============================================
  const isMachineTransaction = (transaction) => {
    return transaction.source === 'machine' || 
           transaction.transactionType === 'machine' ||
           (transaction.recordedBy === null && transaction.user === null);
  };

  const isManualTransaction = (transaction) => {
    return transaction.recordedBy !== null && transaction.recordedBy !== undefined;
  };
  // ============================================

  useEffect(() => {
    fetchSalesSummary();
    fetchChartData('daily');
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const getTransactionSourceText = (transaction) => {
    if (isManualTransaction(transaction)) {
      return 'Manual';
    }
    if (isMachineTransaction(transaction)) {
      return 'Machine';
    }
    return 'System';
  };

  const fetchSalesSummary = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/transactions/stats`);
      setSalesSummary(response.data.data);
    } catch (error) {
      console.error('Error fetching sales summary:', error);
    }
  };

  const calculateProductRanking = (transactions) => {
    const productSales = {};
    
    transactions.forEach(t => {
      const productName = t.riceType || t.productName || 'Unknown Grain';
      const quantity = t.quantityKg || 0;
      const revenue = t.amountPaid || t.totalAmount || 0;
      
      if (!productSales[productName]) {
        productSales[productName] = { quantity: 0, revenue: 0, count: 0 };
      }
      productSales[productName].quantity += quantity;
      productSales[productName].revenue += revenue;
      productSales[productName].count += 1;
    });
    
    const ranking = Object.entries(productSales).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: data.revenue,
      count: data.count,
      avgPrice: data.revenue / data.quantity
    }));
    
    ranking.sort((a, b) => b.quantity - a.quantity);
    setProductRanking(ranking);
    setBestSellingProduct(ranking.length > 0 ? ranking[0] : null);
  };

  const fetchChartData = async (type) => {
    try {
      let url = '';
      let params = {};
      
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      if (type === 'daily') {
        url = `${API_URL}/admin/reports/daily`;
        params = { date: today.toISOString().split('T')[0] };
      } else if (type === 'weekly') {
        url = `${API_URL}/admin/reports/weekly`;
        const weekNumber = getWeekNumber(today);
        params = { week: weekNumber, year: year };
      } else if (type === 'monthly') {
        url = `${API_URL}/admin/reports/monthly`;
        params = { month: month, year: year };
      } else {
        return;
      }
      
      const response = await axios.get(url, { params });
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        let processedChartData = [];
        
        if (type === 'daily' && data.chartData) {
          const hoursData = {};
          for (let i = 0; i < 24; i++) {
            const hourLabel = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`;
            hoursData[hourLabel] = 0;
          }
          
          data.transactions?.forEach(t => {
            const hour = new Date(t.createdAt).getHours();
            const hourLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour-12} PM`;
            hoursData[hourLabel] += t.amountPaid || t.totalAmount || 0;
          });
          
          processedChartData = Object.entries(hoursData).map(([label, sales]) => ({ label, sales }));
        } else if (type === 'weekly' && data.chartData) {
          const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          const daysData = {};
          daysOrder.forEach(day => { daysData[day] = 0; });
          
          data.transactions?.forEach(t => {
            const dayIndex = new Date(t.createdAt).getDay();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const day = dayNames[dayIndex];
            daysData[day] += t.amountPaid || t.totalAmount || 0;
          });
          
          processedChartData = daysOrder.map(day => ({ label: day, sales: daysData[day] || 0 }));
        } else if (type === 'monthly' && data.chartData) {
          const weeksData = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0, 'Week 5': 0 };
          
          data.transactions?.forEach(t => {
            const day = new Date(t.createdAt).getDate();
            let week = 'Week 1';
            if (day <= 7) week = 'Week 1';
            else if (day <= 14) week = 'Week 2';
            else if (day <= 21) week = 'Week 3';
            else if (day <= 28) week = 'Week 4';
            else week = 'Week 5';
            
            weeksData[week] += t.amountPaid || t.totalAmount || 0;
          });
          
          processedChartData = Object.entries(weeksData).map(([label, sales]) => ({ label, sales }));
        }
        
        if (data.transactions && data.transactions.length > 0) {
          calculateProductRanking(data.transactions);
        }
        
        const nonZeroData = processedChartData.filter(item => item.sales > 0);
        setChartData(nonZeroData.length > 0 ? nonZeroData : processedChartData);
      } else {
        setChartData(getSampleChartData(type));
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData(getSampleChartData(type));
    }
  };

  const getSampleChartData = (type) => {
    if (type === 'daily') {
      return [
        { label: '8:00 AM', sales: 135 },
        { label: '10:00 AM', sales: 97.5 },
        { label: '12:00 PM', sales: 180 },
        { label: '2:00 PM', sales: 85 },
        { label: '4:00 PM', sales: 216 }
      ];
    } else if (type === 'weekly') {
      return [
        { label: 'Monday', sales: 120 },
        { label: 'Tuesday', sales: 95 },
        { label: 'Wednesday', sales: 180 },
        { label: 'Thursday', sales: 85 },
        { label: 'Friday', sales: 216 },
        { label: 'Saturday', sales: 150 },
        { label: 'Sunday', sales: 75 }
      ];
    } else {
      return [
        { label: 'Week 1', sales: 450 },
        { label: 'Week 2', sales: 680 },
        { label: 'Week 3', sales: 520 },
        { label: 'Week 4', sales: 890 }
      ];
    }
  };

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const calculateFilteredSummary = (transactions) => {
    return {
      totalTransactions: transactions.length,
      totalQuantity: transactions.reduce((s, t) => s + (t.quantityKg || 0), 0),
      totalSales: transactions.reduce((s, t) => s + (t.amountPaid || 0), 0),
      averageOrderValue: transactions.length > 0 ? transactions.reduce((s, t) => s + (t.amountPaid || 0), 0) / transactions.length : 0
    };
  };

  // ============================================
  // FIXED GENERATE REPORT FUNCTION
  // ============================================
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
          const date = new Date(dateRange.startDate);
          params = { week: getWeekNumber(date), year: date.getFullYear() };
          break;
        case 'monthly':
          url = `${API_URL}/admin/reports/monthly`;
          const monthDate = new Date(dateRange.startDate);
          params = { month: monthDate.getMonth() + 1, year: monthDate.getFullYear() };
          break;
        case 'custom':
          url = `${API_URL}/admin/reports/custom`;
          params = { startDate: dateRange.startDate, endDate: dateRange.endDate };
          break;
      }
      
      const response = await axios.get(url, { params });
      
      let data = response.data.data;
      if (data && data.transactions) {
        // FIX: Filter based on transaction source correctly using helper functions
        if (transactionSource === 'manual') {
          data.transactions = data.transactions.filter(t => isManualTransaction(t));
          data.summary = calculateFilteredSummary(data.transactions);
        } else if (transactionSource === 'machine') {
          data.transactions = data.transactions.filter(t => isMachineTransaction(t));
          data.summary = calculateFilteredSummary(data.transactions);
        } else {
          data.summary = calculateFilteredSummary(data.transactions);
        }
        
        if (data.transactions.length > 0) {
          calculateProductRanking(data.transactions);
        } else {
          setProductRanking([]);
          setBestSellingProduct(null);
        }
      }
      
      setReportData(data);
      showNotification('success', 'Report generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      showNotification('error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };
  // ============================================

  const handleChartTabChange = (tab) => {
    setActiveChartTab(tab);
    fetchChartData(tab);
  };

  const handlePrintReport = () => {
    const currentDate = new Date().toLocaleString();
    const reportTitle = getReportTitle();
    const sourceText = getSourceText();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle} - AgriVend</title>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              padding: 40px;
              color: #1a1a2e;
              line-height: 1.5;
            }
            .print-container { max-width: 1200px; margin: 0 auto; }
            .print-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2d6a4f; }
            .company-name { font-size: 28px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px; }
            .company-tagline { font-size: 14px; color: #64748b; margin-bottom: 15px; }
            .report-title { font-size: 22px; font-weight: 600; color: #1e293b; margin-top: 15px; margin-bottom: 10px; }
            .report-meta { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
            .best-seller-section { background: #2d6a4f; border-radius: 8px; padding: 25px; margin-bottom: 30px; color: white; text-align: center; }
            .best-seller-title { font-size: 13px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 10px; }
            .best-seller-name { font-size: 26px; font-weight: 700; margin-bottom: 10px; }
            .best-seller-stats { display: flex; justify-content: center; gap: 30px; font-size: 14px; }
            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
            .summary-card { background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e2e8f0; }
            .summary-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
            .summary-value { font-size: 28px; font-weight: 700; color: #2d6a4f; }
            .summary-sub { font-size: 11px; color: #94a3b8; margin-top: 5px; }
            .product-ranking-section { margin-bottom: 30px; }
            .product-ranking-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #2d6a4f; }
            .product-ranking-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .product-ranking-table th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; color: #334155; border-bottom: 1px solid #e2e8f0; }
            .product-ranking-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .stats-grid-print { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card-print { background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; }
            .stat-label-print { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
            .stat-number-print { font-size: 32px; font-weight: 700; color: #2d6a4f; }
            .chart-section-print { margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; }
            .chart-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; color: #1e293b; }
            .chart-bars { display: flex; align-items: flex-end; justify-content: space-around; gap: 15px; height: 250px; padding: 20px 0; }
            .chart-bar-item { flex: 1; text-align: center; }
            .chart-bar { background: #2d6a4f; border-radius: 4px 4px 0 0; margin-bottom: 8px; min-height: 4px; }
            .chart-label { font-size: 11px; color: #64748b; }
            .chart-value { font-size: 10px; font-weight: 600; color: #2d6a4f; margin-bottom: 5px; }
            .transaction-table-title { font-size: 18px; font-weight: 600; margin: 20px 0 15px; padding-bottom: 10px; border-bottom: 2px solid #2d6a4f; }
            .transaction-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .transaction-table th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; color: #334155; border-bottom: 2px solid #2d6a4f; }
            .transaction-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .source-badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .source-badge.manual { background: #eff6ff; color: #1e40af; }
            .source-badge.machine { background: #ecfdf5; color: #065f46; }
            .source-badge.system { background: #f1f5f9; color: #64748b; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .print-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
            .signature-line { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature { text-align: center; width: 250px; }
            .signature-line-space { border-top: 1px solid #1e293b; margin-top: 30px; padding-top: 5px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="print-header">
              <div class="company-name">AGRIVEND</div>
              <div class="company-tagline">Enterprise Grain Vending Solution</div>
              <div class="report-title">${reportTitle}</div>
              <div class="report-source-info">Transaction Source: ${sourceText}</div>
              <div class="report-meta">
                <span>Generated By: ${user?.firstName || 'Administrator'} ${user?.lastName || ''}</span>
                <span>Date & Time: ${currentDate}</span>
                <span>Report ID: ${'RPT-' + Date.now().toString().slice(-8)}</span>
              </div>
            </div>
            
            ${bestSellingProduct ? `
            <div class="best-seller-section">
              <div class="best-seller-title">BEST SELLING PRODUCT</div>
              <div class="best-seller-name">${bestSellingProduct.name}</div>
              <div class="best-seller-stats">
                <div>${bestSellingProduct.quantity.toFixed(1)} kg sold</div>
                <div>${formatCurrency(bestSellingProduct.revenue)} revenue</div>
                <div>${bestSellingProduct.count} transactions</div>
              </div>
            </div>
            ` : ''}
            
            <div class="summary-cards">
              <div class="summary-card"><div class="summary-label">Total Transactions</div><div class="summary-value">${reportData?.summary?.totalTransactions || 0}</div><div class="summary-sub">Completed Sales</div></div>
              <div class="summary-card"><div class="summary-label">Total Quantity</div><div class="summary-value">${reportData?.summary?.totalQuantity || 0} kg</div><div class="summary-sub">Grain Sold</div></div>
              <div class="summary-card"><div class="summary-label">Average Order Value</div><div class="summary-value">${formatCurrency(reportData?.summary?.totalSales / (reportData?.summary?.totalTransactions || 1))}</div><div class="summary-sub">Per Transaction</div></div>
              <div class="summary-card"><div class="summary-label">Total Revenue</div><div class="summary-value">${formatCurrency(reportData?.summary?.totalSales || 0)}</div><div class="summary-sub">Gross Sales</div></div>
            </div>
            
            ${productRanking.length > 0 ? `
            <div class="product-ranking-section">
              <div class="product-ranking-title">Product Performance Ranking</div>
              <table class="product-ranking-table">
                <thead><tr><th>Rank</th><th>Product Name</th><th>Quantity Sold (kg)</th><th>Revenue</th><th>Transactions</th></tr></thead>
                <tbody>
                  ${productRanking.map((product, idx) => `<tr><td class="rank-number">${idx + 1}</td><td><strong>${product.name}</strong></td><td>${product.quantity.toFixed(1)} kg</td><td>${formatCurrency(product.revenue)}</td><td>${product.count}</td>`).join('')}
                </tbody>
              70
            </div>
            ` : ''}
            
            <div class="stats-grid-print">
              <div class="stat-card-print"><div class="stat-label-print">Today's Sales</div><div class="stat-number-print">${formatCurrency(salesSummary.daily)}</div></div>
              <div class="stat-card-print"><div class="stat-label-print">This Week</div><div class="stat-number-print">${formatCurrency(salesSummary.weekly)}</div></div>
              <div class="stat-card-print"><div class="stat-label-print">This Month</div><div class="stat-number-print">${formatCurrency(salesSummary.monthly)}</div></div>
            </div>
            
            <div class="chart-section-print">
              <div class="chart-title">Sales Performance Chart</div>
              <div class="chart-bars">
                ${chartData.map(item => {
                  const maxSales = Math.max(...chartData.map(d => d.sales || 0), 1);
                  const barHeight = ((item.sales || 0) / maxSales) * 200;
                  return `<div class="chart-bar-item"><div class="chart-value">${formatCurrency(item.sales)}</div><div class="chart-bar" style="height: ${Math.max(barHeight, 4)}px; width: 100%;"></div><div class="chart-label">${item.label}</div></div>`;
                }).join('')}
              </div>
            </div>
            
            <div class="transaction-table-title">Transaction Details</div>
            <table class="transaction-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Product Name</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                ${reportData?.transactions?.map(t => {
                  const source = getTransactionSourceText(t);
                  const sourceClass = source === 'Manual' ? 'manual' : (source === 'Machine' ? 'machine' : 'system');
                  return `
                    <tr>
                      <td>${t.transactionId || t._id?.slice(-8) || 'N/A'}</td>
                      <td>${new Date(t.createdAt).toLocaleString()}</td>
                      <td>${t.riceType || t.productName}</td>
                      <td>${t.quantityKg} kg</td>
                      <td class="text-right font-bold">${formatCurrency(t.amountPaid || t.totalAmount)}</td>
                      <td><span class="source-badge ${sourceClass}">${source}</span></td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="6" class="text-center">No transactions found</td></tr>'}
              </tbody>
              <tfoot>
                <tr style="background: #f1f5f9; font-weight: 700;">
                  <td colspan="4" class="text-right">Total:</td>
                  <td class="text-right">${formatCurrency(reportData?.summary?.totalSales || 0)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            
            <div class="print-footer"><p>This is a computer-generated document. No signature is required.</p><p>AgriVend - Enterprise Grain Vending Management | support@agrivend.com</p></div>
            <div class="signature-line">
              <div class="signature"><div class="signature-line-space">_________________</div><div>Generated By</div><div style="font-size: 11px; color: #64748b;">${user?.firstName} ${user?.lastName}</div></div>
              <div class="signature"><div class="signature-line-space">_________________</div><div>Authorized Signature</div><div style="font-size: 11px; color: #64748b;">Management Officer</div></div>
              <div class="signature"><div class="signature-line-space">_________________</div><div>Date Received</div><div style="font-size: 11px; color: #64748b;">${new Date().toLocaleDateString()}</div></div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadCSV = () => {
    if (!reportData || !reportData.transactions || reportData.transactions.length === 0) {
      showNotification('error', 'No data to export');
      return;
    }
    
    const headers = ['Transaction ID', 'Date', 'Product Name', 'Quantity (kg)', 'Amount', 'Source'];
    const rows = reportData.transactions.map(t => [
      t.transactionId || t._id?.slice(-8) || 'N/A',
      new Date(t.createdAt).toLocaleString(),
      t.riceType || t.productName,
      t.quantityKg,
      t.amountPaid || t.totalAmount,
      getTransactionSourceText(t)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
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
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
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
      case 'daily': return `Daily Sales Report - ${formatDate(dateRange.startDate)}`;
      case 'weekly': return `Weekly Sales Report - Week of ${formatDate(dateRange.startDate)}`;
      case 'monthly': 
        const date = new Date(dateRange.startDate);
        return `Monthly Sales Report - ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      case 'custom': return `Custom Sales Report - ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`;
      default: return 'Sales Report';
    }
  };

  const getSourceText = () => {
    switch(transactionSource) {
      case 'manual': return 'Manual Sales Only';
      case 'machine': return 'Machine Sales Only';
      default: return 'All Sales';
    }
  };

  const maxSales = chartData.length > 0 ? Math.max(...chartData.map(d => d.sales || 0), 1) : 1;

  return (
    <div className="admin-page-container">
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className={notification.type === 'success' ? 'toast-success' : 'toast-error'}>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-description">Generate, visualize, and export professional sales reports</p>
        </div>
      </div>

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

      {bestSellingProduct && (
        <div className="best-seller-card">
          <div className="best-seller-content">
            <div className="best-seller-label">BEST SELLING PRODUCT</div>
            <div className="best-seller-name">{bestSellingProduct.name}</div>
            <div className="best-seller-stats">
              <div className="stat-item">{bestSellingProduct.quantity.toFixed(1)} kg sold</div>
              <div className="stat-item">{formatCurrency(bestSellingProduct.revenue)} revenue</div>
              <div className="stat-item">{bestSellingProduct.count} transactions</div>
            </div>
          </div>
        </div>
      )}

      <div className="product-ranking-container">
        <div className="product-ranking-header">
          <h2>Product Performance Ranking</h2>
          <p>Top selling products by quantity</p>
        </div>
        <div className="product-ranking-list">
          {productRanking.slice(0, 5).map((product, index) => (
            <div key={index} className={`product-rank-item ${index === 0 ? 'top-rank' : ''}`}>
              <div className="rank-number-display">#{index + 1}</div>
              <div className="product-info">
                <div className="product-name">{product.name}</div>
                <div className="product-stats">
                  <span>{product.quantity.toFixed(1)} kg</span>
                  <span>{formatCurrency(product.revenue)}</span>
                </div>
              </div>
              <div className="rank-progress">
                <div className="progress-bar" style={{ width: `${(product.quantity / productRanking[0]?.quantity) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <h2>Sales Visualization</h2>
          <div className="chart-tabs">
            <button className={`chart-tab ${activeChartTab === 'daily' ? 'active' : ''}`} onClick={() => handleChartTabChange('daily')}>Daily</button>
            <button className={`chart-tab ${activeChartTab === 'weekly' ? 'active' : ''}`} onClick={() => handleChartTabChange('weekly')}>Weekly</button>
            <button className={`chart-tab ${activeChartTab === 'monthly' ? 'active' : ''}`} onClick={() => handleChartTabChange('monthly')}>Monthly</button>
          </div>
        </div>
        
        <div className="chart-container">
          {chartData.length > 0 ? (
            <div className="bar-chart">
              {chartData.map((item, index) => {
                const salesValue = item.sales || 0;
                const barHeight = (salesValue / maxSales) * 100;
                return (
                  <div key={index} className="bar-item">
                    <div className="bar-label">{item.label}</div>
                    <div className="bar-wrapper">
                      <div className="bar" style={{ height: `${Math.max(barHeight, 4)}%` }}>
                        <span className="bar-value">{formatCurrency(salesValue)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-data-message"><p>No sales data available for this period</p></div>
          )}
        </div>
      </div>

      <div className="report-generator">
        <h2>Generate Report</h2>
        <div className="report-controls">
          <div className="report-type-selector">
            <button className={`report-type-btn ${reportType === 'daily' ? 'active' : ''}`} onClick={() => setReportType('daily')}>Daily</button>
            <button className={`report-type-btn ${reportType === 'weekly' ? 'active' : ''}`} onClick={() => setReportType('weekly')}>Weekly</button>
            <button className={`report-type-btn ${reportType === 'monthly' ? 'active' : ''}`} onClick={() => setReportType('monthly')}>Monthly</button>
            <button className={`report-type-btn ${reportType === 'custom' ? 'active' : ''}`} onClick={() => setReportType('custom')}>Custom Range</button>
          </div>
          
          <div className="source-selector">
            <label className="source-label">Transaction Source:</label>
            <select 
              value={transactionSource} 
              onChange={(e) => setTransactionSource(e.target.value)}
              className="source-select"
            >
              <option value="all">All Sales</option>
              <option value="manual">Manual Sales Only</option>
              <option value="machine">Machine Sales Only</option>
            </select>
          </div>
          
          <div className="date-range">
            {reportType === 'custom' ? (
              <>
                <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="form-input" />
                <span>to</span>
                <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} className="form-input" />
              </>
            ) : (
              <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="form-input" />
            )}
          </div>
          
          <button className="btn-primary" onClick={generateReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {reportData && reportData.transactions && reportData.transactions.length > 0 && (
        <>
          <div className="report-content">
            <div className="report-header">
              <h1 className="report-title">{getReportTitle()}</h1>
              <p className="report-date">Generated on: {new Date().toLocaleString()}</p>
              <p className="report-generator">Generated by: {user?.firstName} {user?.lastName}</p>
              <p className="report-source">Transaction Source: {getSourceText()}</p>
            </div>
            
            <div className="report-summary">
              <h3>Summary</h3>
              <div className="summary-grid">
                <div className="summary-item"><span className="summary-label">Total Transactions:</span><span className="summary-value">{reportData.summary?.totalTransactions || 0}</span></div>
                <div className="summary-item"><span className="summary-label">Total Quantity Sold:</span><span className="summary-value">{reportData.summary?.totalQuantity || 0} kg</span></div>
                <div className="summary-item"><span className="summary-label">Total Sales:</span><span className="summary-value total">{formatCurrency(reportData.summary?.totalSales || 0)}</span></div>
              </div>
            </div>
            
            <div className="report-details">
              <h3>Transaction Details</h3>
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr><th>Transaction ID</th><th>Date & Time</th><th>Product Name</th><th>Quantity (kg)</th><th>Total Amount</th></tr>
                  </thead>
                  <tbody>
                    {reportData.transactions.map((transaction) => (
                      <tr key={transaction._id}>
                        <td>{transaction.transactionId || transaction._id?.slice(-8)}</td>
                        <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                        <td>{transaction.riceType || transaction.productName}</td>
                        <td>{transaction.quantityKg}</td>
                        <td>{formatCurrency(transaction.amountPaid || transaction.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="report-actions no-print">
            <button className="btn-secondary" onClick={handlePrintReport}>Print Report</button>
            <button className="btn-primary" onClick={handleDownloadCSV}>Download CSV</button>
          </div>
        </>
      )}
      
      {reportData && (!reportData.transactions || reportData.transactions.length === 0) && (
        <div className="no-data-message full"><p>No transactions found for this period with the selected filter.</p></div>
      )}
    </div>
  );
};

export default AdminReports;