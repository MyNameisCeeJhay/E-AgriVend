import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './Reports.css';

const API_URL = 'https://e-agrivend.onrender.com/api';

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
  const [reportHistory, setReportHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [viewingHistoryReport, setViewingHistoryReport] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const reportContentRef = useRef(null);

  // Generate control number
  const generateControlNumber = () => {
    const prefix = 'AGR';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${date}-${random}`;
  };

  // Load report history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('agrivend_report_history');
    if (savedHistory) {
      try {
        setReportHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading report history:', e);
      }
    }
  }, []);

  // Save report history to localStorage
  const saveToHistory = (report) => {
    const newHistory = [report, ...reportHistory];
    setReportHistory(newHistory);
    localStorage.setItem('agrivend_report_history', JSON.stringify(newHistory));
  };

  // ===== SAVE REPORT TO DATABASE =====
  const saveReportToDatabase = async (reportData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/admin/reports/save`, reportData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data.success) {
        console.log('✅ Report saved to database:', response.data.data);
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('❌ Error saving report to database:', error);
      return null;
    }
  };

  // ===== FETCH REPORT HISTORY FROM DATABASE =====
  const fetchReportHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/reports/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data.success) {
        const reports = response.data.data || [];
        setReportHistory(reports);
        localStorage.setItem('agrivend_report_history', JSON.stringify(reports));
        return reports;
      }
      return [];
    } catch (error) {
      console.error('❌ Error fetching report history:', error);
      const savedHistory = localStorage.getItem('agrivend_report_history');
      if (savedHistory) {
        try {
          setReportHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error('Error loading report history:', e);
        }
      }
      return [];
    }
  };

  const isMachineTransaction = (transaction) => {
    if (!transaction) return false;
    if (transaction.source === 'machine') return true;
    if (transaction.transactionType === 'machine') return true;
    if (transaction.recordedBy === null || transaction.recordedBy === 'null') return true;
    if (transaction.recordedBy === undefined) return true;
    if (transaction.recordedBy === 'machine') return true;
    if (transaction.recordedBy === 'System' || transaction.recordedBy === 'system') return true;
    if (transaction.user === null || transaction.user === undefined) return true;
    if (transaction.user === 'null') return true;
    if (transaction.isMachineTransaction === true) return true;
    if (transaction.recordedBy && typeof transaction.recordedBy === 'object') {
      if (!transaction.recordedBy.firstName && !transaction.recordedBy.lastName) {
        return true;
      }
    }
    return false;
  };

  const isManualTransaction = (transaction) => {
    if (!transaction) return false;
    if (transaction.recordedBy && typeof transaction.recordedBy === 'object') {
      if (transaction.recordedBy.firstName || transaction.recordedBy.lastName) {
        return true;
      }
    }
    if (transaction.user && typeof transaction.user === 'object') {
      if (transaction.user.firstName || transaction.user.lastName) {
        return true;
      }
    }
    if (transaction.recordedBy && typeof transaction.recordedBy === 'string') {
      const lower = transaction.recordedBy.toLowerCase();
      if (lower !== 'machine' && lower !== 'system' && lower !== 'null' && transaction.recordedBy.length > 2) {
        return true;
      }
    }
    return false;
  };

  const getTransactionSourceText = (transaction) => {
    if (isManualTransaction(transaction)) {
      if (transaction.recordedBy?.firstName) {
        return `${transaction.recordedBy.firstName} ${transaction.recordedBy.lastName || ''}`.trim();
      }
      if (transaction.user?.firstName) {
        return `${transaction.user.firstName} ${transaction.user.lastName || ''}`.trim();
      }
      if (typeof transaction.recordedBy === 'string') {
        return transaction.recordedBy;
      }
      return 'Staff';
    }
    if (isMachineTransaction(transaction)) {
      return 'Machine';
    }
    return 'System';
  };

  useEffect(() => {
    fetchSalesSummary();
    fetchChartData('daily');
    fetchReportHistory();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchSalesSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/transactions/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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

  const generateReport = async () => {
    setLoading(true);
    try {
      let url = '';
      let params = {};

      switch (reportType) {
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

      const token = localStorage.getItem('token');
      const response = await axios.get(url, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      let data = response.data.data;
      if (data && data.transactions) {
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

        const controlNumber = generateControlNumber();
        const reportTitle = getReportTitle();

        // Prepare report data - FIX: Convert generatedBy to string properly
        const reportEntry = {
          controlNumber,
          title: reportTitle,
          type: reportType,
          dateRange: {
            start: dateRange.startDate,
            end: reportType === 'custom' ? dateRange.endDate : dateRange.startDate
          },
          transactionSource: transactionSource,
          summary: {
            totalTransactions: data.summary?.totalTransactions || 0,
            totalQuantity: data.summary?.totalQuantity || 0,
            totalSales: data.summary?.totalSales || 0,
            averageOrderValue: data.summary?.averageOrderValue || 0
          },
          transactions: data.transactions.map(t => ({
            transactionId: t.transactionId || t._id?.slice(-8),
            createdAt: t.createdAt,
            riceType: t.riceType,
            productName: t.productName,
            quantityKg: t.quantityKg,
            amountPaid: t.amountPaid,
            totalAmount: t.amountPaid || t.totalAmount,
            source: getTransactionSourceText(t),
            paymentMethod: t.paymentMethod || 'CASH'
          })),
          productRanking: productRanking.map(p => ({
            name: p.name,
            quantity: p.quantity,
            revenue: p.revenue,
            count: p.count,
            avgPrice: p.avgPrice
          })),
          generatedBy: {
            name: `${user?.firstName || 'Admin'} ${user?.lastName || 'User'}`,
            userId: user?._id
          },
          generatedAt: new Date().toISOString()
        };

        // Save to database
        const savedReport = await saveReportToDatabase(reportEntry);

        // Also save to localStorage for quick access
        if (savedReport) {
          const newHistory = [savedReport, ...reportHistory];
          setReportHistory(newHistory);
          localStorage.setItem('agrivend_report_history', JSON.stringify(newHistory));
        }

        const report = {
          ...data,
          controlNumber,
          generatedBy: `${user?.firstName || 'Admin'} ${user?.lastName || 'User'}`, // Convert to string
          generatedAt: reportEntry.generatedAt,
          reportTitle,
          dateRange: reportEntry.dateRange
        };

        setGeneratedReport(report);
        setShowReportModal(true);
        setReportData(data);
        showNotification('success', `Report generated! Control #: ${controlNumber}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showNotification('error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleChartTabChange = (tab) => {
    setActiveChartTab(tab);
    fetchChartData(tab);
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

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getReportTitle = () => {
    switch (reportType) {
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
    switch (transactionSource) {
      case 'manual': return 'Manual Sales Only';
      case 'machine': return 'Machine Sales Only';
      default: return 'All Sales';
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  // ===== VIEW HISTORY REPORT =====
  const handleViewHistoryReport = (report) => {
    // FIX: Convert generatedBy to string if it's an object
    const fixedReport = {
      ...report,
      generatedBy: typeof report.generatedBy === 'object' 
        ? report.generatedBy.name || 'Admin' 
        : report.generatedBy || 'Admin'
    };
    setViewingHistoryReport(fixedReport);
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingHistoryReport(null);
  };

  const handlePrintHistoryReport = () => {
    if (!viewingHistoryReport) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    const reportTitle = viewingHistoryReport.title || 'Sales Report';
    const controlNumber = viewingHistoryReport.controlNumber || 'N/A';
    const generatedBy = typeof viewingHistoryReport.generatedBy === 'object'
      ? viewingHistoryReport.generatedBy.name || 'Admin'
      : viewingHistoryReport.generatedBy || 'Admin';
    const generatedAt = viewingHistoryReport.generatedAt || new Date().toISOString();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${reportTitle} - AgriVend</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              padding: 40px;
              color: #1a1a2e;
              line-height: 1.5;
            }
            .print-container { max-width: 1200px; margin: 0 auto; }
            .report-header {
              text-align: center;
              padding-bottom: 1.5rem;
              border-bottom: 2px solid #1a472a;
              margin-bottom: 1.5rem;
            }
            .company-name { font-size: 2rem; font-weight: 700; color: #1a472a; letter-spacing: 2px; }
            .company-subtitle { font-size: 0.875rem; color: #64748b; margin: 0.25rem 0 1rem; }
            .report-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin: 0.5rem 0; }
            .control-number { font-weight: 700; color: #059669; background: #ecfdf5; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: 1px solid #d1fae5; font-family: monospace; }
            .report-meta { display: flex; justify-content: center; gap: 2rem; font-size: 0.8rem; color: #64748b; margin-top: 0.75rem; flex-wrap: wrap; }
            .report-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
            .summary-item { background: #f8fafc; border-radius: 0.5rem; padding: 1rem; text-align: center; border: 1px solid #e2e8f0; }
            .summary-item .summary-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 0.5rem; }
            .summary-item .summary-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
            .summary-item .summary-value.total { color: #059669; }
            .report-details h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 0 0 1rem; }
            .table-wrapper { overflow-x: auto; }
            .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
            .report-table th { background: #f1f5f9; padding: 0.75rem; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .report-table td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .report-table tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
            .text-right { text-align: right; }
            .report-footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; text-align: center; font-size: 0.75rem; color: #64748b; }
            .report-footer .verification { color: #059669; font-weight: 500; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="report-header">
              <h1 class="company-name">AgriVend</h1>
              <p class="company-subtitle">Enterprise Grain Vending Solution</p>
              <h2 class="report-title">${reportTitle}</h2>
              <p class="report-control">Control Number: <span class="control-number">${controlNumber}</span></p>
              <div class="report-meta">
                <span>Generated By: ${generatedBy}</span>
                <span>Date & Time: ${formatDateTime(generatedAt)}</span>
                <span>Transaction Source: ${viewingHistoryReport.source === 'manual' ? 'Manual Sales Only' : 
                  viewingHistoryReport.source === 'machine' ? 'Machine Sales Only' : 'All Sales'}</span>
              </div>
            </div>

            <div class="report-summary">
              <div class="summary-item">
                <span class="summary-label">Total Transactions</span>
                <span class="summary-value">${viewingHistoryReport.totalTransactions || 0}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Quantity</span>
                <span class="summary-value">${(viewingHistoryReport.totalQuantity || 0).toFixed(2)} kg</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Revenue</span>
                <span class="summary-value total">${formatCurrency(viewingHistoryReport.totalSales || 0)}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Average Order Value</span>
                <span class="summary-value">${formatCurrency((viewingHistoryReport.totalSales || 0) / (viewingHistoryReport.totalTransactions || 1))}</span>
              </div>
            </div>

            <div class="report-details">
              <h3>Transaction Details</h3>
              <div class="table-wrapper">
                <table class="report-table">
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
                    <tr>
                      <td colspan="6" class="text-center" style="padding: 2rem; color: #64748b;">
                        Full transaction details available in the original report.
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" class="text-right"><strong>Total</strong></td>
                      <td><strong>${formatCurrency(viewingHistoryReport.totalSales || 0)}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div class="report-footer">
              <p>This is a computer-generated document. No signature is required.</p>
              <p>AgriVend - Enterprise Grain Vending Management</p>
              <p class="verification">Verified: ${formatDateTime(generatedAt)} | Control: ${controlNumber}</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadHistoryReport = () => {
    if (!viewingHistoryReport) return;

    const reportTitle = viewingHistoryReport.title || 'Sales Report';
    const controlNumber = viewingHistoryReport.controlNumber || 'N/A';
    const generatedBy = typeof viewingHistoryReport.generatedBy === 'object'
      ? viewingHistoryReport.generatedBy.name || 'Admin'
      : viewingHistoryReport.generatedBy || 'Admin';
    const generatedAt = viewingHistoryReport.generatedAt || new Date().toISOString();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${reportTitle} - AgriVend</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              padding: 40px;
              color: #1a1a2e;
              line-height: 1.5;
            }
            .print-container { max-width: 1200px; margin: 0 auto; }
            .report-header {
              text-align: center;
              padding-bottom: 1.5rem;
              border-bottom: 2px solid #1a472a;
              margin-bottom: 1.5rem;
            }
            .company-name { font-size: 2rem; font-weight: 700; color: #1a472a; letter-spacing: 2px; }
            .company-subtitle { font-size: 0.875rem; color: #64748b; margin: 0.25rem 0 1rem; }
            .report-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin: 0.5rem 0; }
            .control-number { font-weight: 700; color: #059669; background: #ecfdf5; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: 1px solid #d1fae5; font-family: monospace; }
            .report-meta { display: flex; justify-content: center; gap: 2rem; font-size: 0.8rem; color: #64748b; margin-top: 0.75rem; flex-wrap: wrap; }
            .report-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
            .summary-item { background: #f8fafc; border-radius: 0.5rem; padding: 1rem; text-align: center; border: 1px solid #e2e8f0; }
            .summary-item .summary-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 0.5rem; }
            .summary-item .summary-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
            .summary-item .summary-value.total { color: #059669; }
            .report-details h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 0 0 1rem; }
            .table-wrapper { overflow-x: auto; }
            .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
            .report-table th { background: #f1f5f9; padding: 0.75rem; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .report-table td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .report-table tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
            .text-right { text-align: right; }
            .report-footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; text-align: center; font-size: 0.75rem; color: #64748b; }
            .report-footer .verification { color: #059669; font-weight: 500; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="report-header">
              <h1 class="company-name">AgriVend</h1>
              <p class="company-subtitle">Enterprise Grain Vending Solution</p>
              <h2 class="report-title">${reportTitle}</h2>
              <p class="report-control">Control Number: <span class="control-number">${controlNumber}</span></p>
              <div class="report-meta">
                <span>Generated By: ${generatedBy}</span>
                <span>Date & Time: ${formatDateTime(generatedAt)}</span>
                <span>Transaction Source: ${viewingHistoryReport.source === 'manual' ? 'Manual Sales Only' : 
                  viewingHistoryReport.source === 'machine' ? 'Machine Sales Only' : 'All Sales'}</span>
              </div>
            </div>

            <div class="report-summary">
              <div class="summary-item">
                <span class="summary-label">Total Transactions</span>
                <span class="summary-value">${viewingHistoryReport.totalTransactions || 0}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Quantity</span>
                <span class="summary-value">${(viewingHistoryReport.totalQuantity || 0).toFixed(2)} kg</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Revenue</span>
                <span class="summary-value total">${formatCurrency(viewingHistoryReport.totalSales || 0)}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Average Order Value</span>
                <span class="summary-value">${formatCurrency((viewingHistoryReport.totalSales || 0) / (viewingHistoryReport.totalTransactions || 1))}</span>
              </div>
            </div>

            <div class="report-details">
              <h3>Transaction Details</h3>
              <div class="table-wrapper">
                <table class="report-table">
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
                    <tr>
                      <td colspan="6" class="text-center" style="padding: 2rem; color: #64748b;">
                        Full transaction details available in the original report.
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" class="text-right"><strong>Total</strong></td>
                      <td><strong>${formatCurrency(viewingHistoryReport.totalSales || 0)}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div class="report-footer">
              <p>This is a computer-generated document. No signature is required.</p>
              <p>AgriVend - Enterprise Grain Vending Management</p>
              <p class="verification">Verified: ${formatDateTime(generatedAt)} | Control: ${controlNumber}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportTitle.replace(/\s/g, '_')}_${controlNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('success', 'Report downloaded successfully!');
  };

  const handlePrintReport = () => {
    if (!generatedReport) return;

    const reportElement = document.getElementById('report-content');
    if (!reportElement) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${generatedReport.reportTitle} - AgriVend</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              padding: 40px;
              color: #1a1a2e;
              line-height: 1.5;
            }
            .print-container { max-width: 1200px; margin: 0 auto; }
            .report-header {
              text-align: center;
              padding-bottom: 1.5rem;
              border-bottom: 2px solid #1a472a;
              margin-bottom: 1.5rem;
            }
            .company-name { font-size: 2rem; font-weight: 700; color: #1a472a; letter-spacing: 2px; }
            .company-subtitle { font-size: 0.875rem; color: #64748b; margin: 0.25rem 0 1rem; }
            .report-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin: 0.5rem 0; }
            .control-number { font-weight: 700; color: #059669; background: #ecfdf5; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: 1px solid #d1fae5; font-family: monospace; }
            .report-meta { display: flex; justify-content: center; gap: 2rem; font-size: 0.8rem; color: #64748b; margin-top: 0.75rem; flex-wrap: wrap; }
            .report-best-seller { background: #1a472a; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center; color: white; }
            .report-best-seller h3 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; margin: 0 0 0.75rem; }
            .best-seller-info .product-name { font-size: 1.5rem; font-weight: 700; display: block; margin-bottom: 0.5rem; }
            .best-seller-info .product-stats { display: flex; justify-content: center; gap: 2rem; font-size: 0.875rem; }
            .report-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
            .summary-item { background: #f8fafc; border-radius: 0.5rem; padding: 1rem; text-align: center; border: 1px solid #e2e8f0; }
            .summary-item .summary-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 0.5rem; }
            .summary-item .summary-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
            .summary-item .summary-value.total { color: #059669; }
            .report-details h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 0 0 1rem; }
            .table-wrapper { overflow-x: auto; }
            .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
            .report-table th { background: #f1f5f9; padding: 0.75rem; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .report-table td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .report-table tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
            .text-right { text-align: right; }
            .report-footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; text-align: center; font-size: 0.75rem; color: #64748b; }
            .report-footer .verification { color: #059669; font-weight: 500; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${reportElement.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadReport = () => {
    if (!generatedReport) return;

    const reportElement = document.getElementById('report-content');
    if (!reportElement) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${generatedReport.reportTitle} - AgriVend</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              padding: 40px;
              color: #1a1a2e;
              line-height: 1.5;
            }
            .print-container { max-width: 1200px; margin: 0 auto; }
            .report-header {
              text-align: center;
              padding-bottom: 1.5rem;
              border-bottom: 2px solid #1a472a;
              margin-bottom: 1.5rem;
            }
            .company-name { font-size: 2rem; font-weight: 700; color: #1a472a; letter-spacing: 2px; }
            .company-subtitle { font-size: 0.875rem; color: #64748b; margin: 0.25rem 0 1rem; }
            .report-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin: 0.5rem 0; }
            .control-number { font-weight: 700; color: #059669; background: #ecfdf5; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: 1px solid #d1fae5; font-family: monospace; }
            .report-meta { display: flex; justify-content: center; gap: 2rem; font-size: 0.8rem; color: #64748b; margin-top: 0.75rem; flex-wrap: wrap; }
            .report-best-seller { background: #1a472a; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center; color: white; }
            .report-best-seller h3 { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; margin: 0 0 0.75rem; }
            .best-seller-info .product-name { font-size: 1.5rem; font-weight: 700; display: block; margin-bottom: 0.5rem; }
            .best-seller-info .product-stats { display: flex; justify-content: center; gap: 2rem; font-size: 0.875rem; }
            .report-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
            .summary-item { background: #f8fafc; border-radius: 0.5rem; padding: 1rem; text-align: center; border: 1px solid #e2e8f0; }
            .summary-item .summary-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 0.5rem; }
            .summary-item .summary-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
            .summary-item .summary-value.total { color: #059669; }
            .report-details h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 0 0 1rem; }
            .table-wrapper { overflow-x: auto; }
            .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
            .report-table th { background: #f1f5f9; padding: 0.75rem; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; }
            .report-table td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .report-table tfoot td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
            .text-right { text-align: right; }
            .report-footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; text-align: center; font-size: 0.75rem; color: #64748b; }
            .report-footer .verification { color: #059669; font-weight: 500; }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${reportElement.innerHTML}
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedReport.reportTitle.replace(/\s/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('success', 'Report downloaded successfully!');
  };

  const maxSales = chartData.length > 0 ? Math.max(...chartData.map(d => d.sales || 0), 1) : 1;

  return (
    <div className="admin-page-container">
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Report History Modal */}
      {showHistory && (
        <div className="history-modal" onClick={() => setShowHistory(false)}>
          <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="history-modal-header">
              <h2>Report History</h2>
              <button className="history-modal-close" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="history-modal-body">
              {reportHistory.length === 0 ? (
                <div className="empty-history">
                  <p>No reports generated yet.</p>
                </div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Control Number</th>
                      <th>Report Title</th>
                      <th>Generated By</th>
                      <th>Date & Time</th>
                      <th>Transactions</th>
                      <th>Total Sales</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportHistory.map((report, index) => {
                      // FIX: Convert generatedBy to string if it's an object
                      const generatedByStr = typeof report.generatedBy === 'object'
                        ? report.generatedBy.name || 'Admin'
                        : report.generatedBy || 'Admin';
                      
                      return (
                        <tr key={index}>
                          <td className="control-number-cell">{report.controlNumber}</td>
                          <td>{report.title}</td>
                          <td>{generatedByStr}</td>
                          <td>{formatDateTime(report.generatedAt)}</td>
                          <td>{report.totalTransactions}</td>
                          <td>{formatCurrency(report.totalSales)}</td>
                          <td>
                            <button 
                              className="btn-view-history"
                              onClick={() => handleViewHistoryReport(report)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="history-modal-footer">
              <button className="btn-secondary" onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* View History Report Modal */}
      {showViewModal && viewingHistoryReport && (
        <div className="history-view-modal" onClick={handleCloseViewModal}>
          <div className="history-view-content" onClick={(e) => e.stopPropagation()}>
            <div className="history-view-header">
              <h2>Report Details</h2>
              <div className="history-view-actions">
                <button className="btn-primary" onClick={handlePrintHistoryReport}>Print</button>
                <button className="btn-secondary" onClick={handleDownloadHistoryReport}>Download</button>
                <button className="history-view-close" onClick={handleCloseViewModal}>×</button>
              </div>
            </div>
            <div className="history-view-body">
              <div className="history-view-info">
                <div className="view-info-row">
                  <span className="view-label">Control Number</span>
                  <span className="view-value">{viewingHistoryReport.controlNumber}</span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Report Title</span>
                  <span className="view-value">{viewingHistoryReport.title}</span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Generated By</span>
                  <span className="view-value">
                    {typeof viewingHistoryReport.generatedBy === 'object'
                      ? viewingHistoryReport.generatedBy.name || 'Admin'
                      : viewingHistoryReport.generatedBy || 'Admin'}
                  </span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Date Generated</span>
                  <span className="view-value">{formatDateTime(viewingHistoryReport.generatedAt)}</span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Report Type</span>
                  <span className="view-value">{viewingHistoryReport.type?.toUpperCase() || 'N/A'}</span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Transaction Source</span>
                  <span className="view-value">
                    {viewingHistoryReport.source === 'manual' ? 'Manual Sales Only' :
                     viewingHistoryReport.source === 'machine' ? 'Machine Sales Only' : 'All Sales'}
                  </span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Total Transactions</span>
                  <span className="view-value">{viewingHistoryReport.totalTransactions || 0}</span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Total Quantity</span>
                  <span className="view-value">{(viewingHistoryReport.totalQuantity || 0).toFixed(2)} kg</span>
                </div>
                <div className="view-info-row">
                  <span className="view-label">Total Sales</span>
                  <span className="view-value total">{formatCurrency(viewingHistoryReport.totalSales || 0)}</span>
                </div>
              </div>
            </div>
            <div className="history-view-footer">
              <button className="btn-secondary" onClick={handleCloseViewModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && generatedReport && (
        <div className="report-modal" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h2>Generated Report</h2>
              <div className="report-modal-actions">
                <button className="btn-primary" onClick={handlePrintReport}>Print</button>
                <button className="btn-secondary" onClick={handleDownloadReport}>Download</button>
                <button className="history-modal-close" onClick={() => setShowReportModal(false)}>×</button>
              </div>
            </div>
            <div className="report-modal-body">
              <div id="report-content" className="report-content" ref={reportContentRef}>
                <div className="report-header">
                  <h1 className="company-name">AgriVend</h1>
                  <p className="company-subtitle">Enterprise Grain Vending Solution</p>
                  <h2 className="report-title">{generatedReport.reportTitle}</h2>
                  <p className="report-control">Control Number: <span className="control-number">{generatedReport.controlNumber}</span></p>
                  <div className="report-meta">
                    <span>Generated By: {generatedReport.generatedBy}</span>
                    <span>Date & Time: {formatDateTime(generatedReport.generatedAt)}</span>
                    <span>Transaction Source: {getSourceText()}</span>
                  </div>
                </div>

                {bestSellingProduct && (
                  <div className="report-best-seller">
                    <h3>Best Selling Product</h3>
                    <div className="best-seller-info">
                      <span className="product-name">{bestSellingProduct.name}</span>
                      <div className="product-stats">
                        <span>{bestSellingProduct.quantity.toFixed(1)} kg sold</span>
                        <span>{formatCurrency(bestSellingProduct.revenue)} revenue</span>
                        <span>{bestSellingProduct.count} transactions</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="report-summary">
                  <div className="summary-item">
                    <span className="summary-label">Total Transactions</span>
                    <span className="summary-value">{generatedReport.summary?.totalTransactions || 0}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Quantity</span>
                    <span className="summary-value">{(generatedReport.summary?.totalQuantity || 0).toFixed(2)} kg</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Revenue</span>
                    <span className="summary-value total">{formatCurrency(generatedReport.summary?.totalSales || 0)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Average Order Value</span>
                    <span className="summary-value">{formatCurrency(generatedReport.summary?.totalSales / (generatedReport.summary?.totalTransactions || 1))}</span>
                  </div>
                </div>

                <div className="report-details">
                  <h3>Transaction Details</h3>
                  <div className="table-wrapper">
                    <table className="report-table">
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
                        {generatedReport.transactions?.map((t, idx) => (
                          <tr key={idx}>
                            <td>{t.transactionId || t._id?.slice(-8) || 'N/A'}</td>
                            <td>{formatDateTime(t.createdAt)}</td>
                            <td>{t.riceType || t.productName || 'N/A'}</td>
                            <td>{t.quantityKg} kg</td>
                            <td>{formatCurrency(t.amountPaid || t.totalAmount)}</td>
                            <td>{getTransactionSourceText(t)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4" className="text-right"><strong>Total</strong></td>
                          <td><strong>{formatCurrency(generatedReport.summary?.totalSales || 0)}</strong></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="report-footer">
                  <p>This is a computer-generated document. No signature is required.</p>
                  <p>AgriVend - Enterprise Grain Vending Management</p>
                  <p className="verification">Verified: {formatDateTime(generatedReport.generatedAt)} | Control: {generatedReport.controlNumber}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-description">Generate, visualize, and export professional sales reports</p>
        </div>
        <button className="btn-history" onClick={() => setShowHistory(true)}>
          Report History ({reportHistory.length})
        </button>
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
            <div className="best-seller-label">Best Selling Product</div>
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
    </div>
  );
};

export default AdminReports;